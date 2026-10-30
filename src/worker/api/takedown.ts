/**
 * 下架申请 —— 唯一一条**不需要 GitHub 登录**的出口。
 *
 * 两张路由：
 *   POST /api/takedown           提交，返回工单号
 *   GET  /api/takedown/:ticket   凭工单号查状态
 *
 * 三件事在这里定死：
 *   1. **提交不自动隐藏。** 匿名提交分不清所有者与路人；立即生效等于给任何人
 *      一个「让任意仓库从榜单消失」的按钮。处理由维护者执行（`docs/runbook.md`）。
 *   2. **不要求、也不保存邮箱。** v1 没有回信渠道，收一个邮箱只会让用户以为会有回信。
 *   3. **只存 HMAC 过的来源。** 限流需要「同一个来源」，不需要「谁」。
 */

import type { TakedownPayload, TakedownStatusPayload, Envelope } from "@/shared/contract";
import { countRecentTakedowns, insertTakedown, readTakedown } from "@/worker/db/takedown-store";
import { recordMetric } from "@/worker/db/metrics-store";
import { normalizeFullName } from "@/worker/db/schema";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { jsonEnvelope, jsonError, makeError } from "./respond";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_REASON_CHARS = 500;
/** 一个来源一小时内最多几次。 */
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
/** 承诺的处理时限。P90 ≤ 24 小时 —— 它是承诺，不是实现的描述。 */
const SLA_HOURS = 24;

const encoder = new TextEncoder();

/** 128 bit 随机工单号，base64url。不可枚举，也读不出任何东西。 */
function newTicket(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 来源的 HMAC。`SESSION_SECRET` 存在就用它；不存在时回落到一个固定盐 ——
 * 限流仍然成立，只是「不可反查」的强度降到「需要暴力枚举 IPv4」。
 * 密钥缺失不该让整条下架路径失效：它存在的全部意义是「有个不用登录的出口」。
 */
async function hashSource(ip: string, secret: string | undefined): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret?.trim() || "repo-vessel:takedown"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function receivedEnvelope(payload: TakedownPayload): Envelope<TakedownPayload> {
  return {
    data: payload,
    completeness: "complete",
    missingPages: [],
    readAt: payload.createdAt,
  };
}

function statusEnvelope(payload: TakedownStatusPayload): Envelope<TakedownStatusPayload> {
  return {
    data: payload,
    completeness: "complete",
    missingPages: [],
    readAt: new Date().toISOString(),
  };
}

export async function handleTakedownSubmit(
  env: Env,
  request: Request,
  topics: readonly string[],
  ctx?: ExecutionContextLike,
): Promise<Response> {
  const body = await readBody(request);
  if (typeof body !== "object" || body === null) {
    return jsonError(makeError("invalid_payload"), { topics, status: 400 });
  }

  const { repo, reason } = body as { repo?: unknown; reason?: unknown };
  const fullName = normalizeFullName(typeof repo === "string" ? repo : "");
  if (fullName === null) {
    return jsonError(
      makeError("invalid_payload", { message: "请填写仓库地址，例如 owner/name。" }),
      { topics, status: 400 },
    );
  }

  if (reason !== undefined && reason !== null && typeof reason !== "string") {
    return jsonError(makeError("invalid_payload"), { topics, status: 400 });
  }
  const note =
    typeof reason === "string" && reason.trim().length > 0
      ? reason.trim().slice(0, MAX_REASON_CHARS)
      : null;

  if (!env.DB) {
    return jsonError(
      makeError("upstream_unavailable", { message: "下架申请暂时提交不了。稍后再试。" }),
      { topics },
    );
  }

  const ip = request.headers.get("cf-connecting-ip");
  const ipHash = ip ? await hashSource(ip, env.SESSION_SECRET) : null;

  if (ipHash) {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const recent = await countRecentTakedowns(env.DB, ipHash, since);
    if (recent >= MAX_PER_WINDOW) {
      return jsonError(makeError("rate_limited", { retryAfter: 3600 }), { topics, status: 429 });
    }
  }

  const createdAt = new Date().toISOString();
  const ticket = newTicket();

  try {
    await insertTakedown(env.DB, { ticket, fullName, reason: note, ipHash, at: createdAt });
  } catch {
    return jsonError(
      makeError("upstream_unavailable", { message: "下架申请暂时提交不了。稍后再试。" }),
      { topics },
    );
  }

  const payload: TakedownPayload = {
    ticket,
    status: "received",
    createdAt,
    slaHours: SLA_HOURS,
  };

  /* 一张工单就是一次「误收录投诉」。处理时长在 `takedown_request` 上，
     由报告脚本按 created_at → updated_at 计算。 */
  void recordMetric(env, "takedown_submit", "received", 1, ctx);

  return jsonEnvelope(receivedEnvelope(payload), { topics, status: 201 });
}

export async function handleTakedownStatus(
  env: Env,
  rawTicket: string,
  topics: readonly string[],
): Promise<Response> {
  const ticket = rawTicket.trim();
  if (ticket.length === 0 || ticket.length > 64) {
    return jsonError(makeError("invalid_payload"), { topics, status: 400 });
  }

  if (!env.DB) {
    return jsonError(
      makeError("upstream_unavailable", { message: "工单状态暂时查不到。稍后再试。" }),
      { topics },
    );
  }

  const row = await readTakedown(env.DB, ticket).catch(() => null);
  if (!row) {
    /* 不确认某张工单是否存在 —— 工单号不可枚举，但查询接口也不该成为枚举工具。 */
    return jsonError(makeError("repo_unavailable", { message: "没有找到这张工单。" }), {
      topics,
      status: 404,
    });
  }

  return jsonEnvelope(
    statusEnvelope({
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
    { topics },
  );
}
