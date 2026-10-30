/**
 * `GET /api/collection-status?repo=owner/name` —— 不需要登录。
 *
 * 先问 D1（零上游请求），只有 D1 给不出答案时才读一次 GitHub。这样常见情况
 * （已收录、刚被下架）不会消耗读取配额，而「还没收录」必须在线确认 ——
 * 否则我们会把「还没轮到」说成「没有主题」。
 *
 * 最关键的一条规则：**读不到时回 `unconfirmed`，绝不退化成 `no-topic`。**
 * 一个假的「你没有加主题」会让用户去改一个根本没问题的设置。
 */

import type { CollectionState, CollectionStatusPayload, Envelope } from "@/shared/contract";
import { classifyRepo } from "@/worker/collect/classify";
import { readCollected } from "@/worker/db/collect-store";
import { normalizeFullName } from "@/worker/db/schema";
import type { Env } from "@/worker/env";
import { GitHubError } from "@/worker/github/client";
import { getRepo } from "@/worker/github/repos";
import { jsonEnvelope, jsonError, makeError } from "./respond";

/**
 * 每个 isolate 的每分钟窗口。
 *
 * 这是**尽力而为**的软限流，不是安全边界：Workers 会在不同 isolate 之间调度
 * 同一个 IP，真正的硬限流属于 Cloudflare 的规则层。它挡的是脚本式连点，
 * 就这一点而言够用。
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

const hits = new Map<string, { count: number; resetAt: number }>();

function overQuota(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  const current = hits.get(ip);
  if (!current || current.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_PER_WINDOW;
}

/** 测试用：清掉窗口，避免用例之间互相影响。 */
export function resetCollectionStatusQuota(): void {
  hits.clear();
}

function envelopeOf(
  fullName: string,
  state: CollectionState,
  matchedTopic: string | null,
  verifiedAt: string | null,
): Envelope<CollectionStatusPayload> {
  return {
    data: { fullName, state, matchedTopic, verifiedAt },
    completeness: "complete",
    missingPages: [],
    readAt: new Date().toISOString(),
  };
}

export async function handleCollectionStatus(
  env: Env,
  request: Request,
  topics: readonly string[],
): Promise<Response> {
  const url = new URL(request.url);
  const fullName = normalizeFullName(url.searchParams.get("repo") ?? "");
  if (fullName === null) {
    return jsonError(makeError("invalid_payload", { message: "仓库名要写成 owner/name。" }), {
      topics,
      status: 400,
    });
  }

  const ip = request.headers.get("cf-connecting-ip");
  if (overQuota(ip)) {
    return jsonError(makeError("rate_limited", { retryAfter: 60 }), { topics, status: 429 });
  }

  /* ------------------------------------------------------------------ D1 */

  let row = null;
  if (env.DB) {
    try {
      row = await readCollected(env.DB, fullName);
    } catch {
      // D1 读不到不阻断：下面会走在线确认。若在线也失败，答案仍是 `unconfirmed`。
      row = null;
    }
  }

  if (row) {
    if (row.hidden_by !== null) {
      /* 隐藏仍在龛里，只是不上榜。状态问的是「收录」，不是「上榜」。 */
      return jsonEnvelope(envelopeOf(fullName, "collected", row.enrolled_topic, row.verified_at), {
        topics,
      });
    }
    if (row.verify_state === "verified") {
      return jsonEnvelope(envelopeOf(fullName, "collected", row.enrolled_topic, row.verified_at), {
        topics,
      });
    }
    if (row.verify_state === "unverified") {
      // 我们自己都还没确认，不再装作能替用户在线确认一次。
      return jsonEnvelope(envelopeOf(fullName, "unconfirmed", row.enrolled_topic, null), {
        topics,
      });
    }
    // `delisted`：可能是它刚刚又加回了主题 —— 在线看一眼。
  }

  /* ------------------------------------------------------------- 在线确认 */

  const [owner, name] = fullName.split("/") as [string, string];

  let repo;
  try {
    repo = await getRepo(env, owner, name);
  } catch (error) {
    if (error instanceof GitHubError && error.kind === "not-found") {
      return jsonError(makeError("repo_unavailable"), { topics, status: 404 });
    }
    return jsonEnvelope(envelopeOf(fullName, "unconfirmed", null, null), { topics });
  }

  const outcome = classifyRepo(repo, topics);

  if (outcome.kind === "unverified") {
    return jsonEnvelope(envelopeOf(fullName, "unconfirmed", null, null), { topics });
  }

  if (outcome.kind === "delisted") {
    const state: CollectionState =
      outcome.reason === "no-topic" ? "no-topic" : "not-eligible";
    return jsonEnvelope(envelopeOf(fullName, state, null, null), { topics });
  }

  // 有主题、公开、个人 —— 只是还没进 D1。下一轮收集会收进来。
  return jsonEnvelope(envelopeOf(fullName, "pending", outcome.enrolledTopic, null), { topics });
}
