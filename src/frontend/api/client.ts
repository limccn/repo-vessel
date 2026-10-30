/**
 * SPA 的**唯一**取数入口。
 *
 * 组件不直接 `fetch`（`.trellis/spec/frontend/hook-guidelines.md` §1）。这一层
 * 只做三件事：发请求、把网络故障翻译成信封、把 `!response.ok` 也翻译成信封。
 *
 * 为什么连 HTTP 错误也返回信封：契约里 `failed` 是一个**正常的结果形态**，
 * 界面已经会渲染它。让调用方区分「返回了错误信封」与「抛异常了」只会让每个
 * 调用点都写两套分支。
 */

import type { ApiError, BoardId, Envelope, ErrorCode } from "@/shared/contract";
import { getActiveLocale, type Locale } from "@/shared/i18n";
import { OFFLINE_MESSAGE } from "@/shared/ids";

/** 信封 + 可选的错误。成功响应没有 `error` 字段。 */
export type ApiEnvelope<T> = Envelope<T> & { error?: ApiError };

export function failedEnvelope(code: ErrorCode, message: string): ApiEnvelope<never> {
  return {
    data: null,
    completeness: "failed",
    missingPages: [],
    readAt: null,
    error: { code, message },
  };
}

function looksLikeEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    "completeness" in candidate &&
    "missingPages" in candidate &&
    "readAt" in candidate &&
    "data" in candidate
  );
}

export async function getEnvelope<T>(
  path: string,
  signal?: AbortSignal,
  locale: Locale = getActiveLocale(),
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      signal,
      headers: { accept: "application/json", "x-rv-locale": locale },
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return failedEnvelope("offline", OFFLINE_MESSAGE);
  }

  return readEnvelope<T>(response);
}

/** 写请求的三种方法。`DELETE` 只用在登录态上，走 `lib/auth.ts`。 */
export type JsonMethod = "POST" | "PATCH";

/**
 * 带 JSON 请求体的写请求。响应的形态与 `getEnvelope` **完全相同** ——
 * 服务端连错误都是信封（`claim_rejected` 带 `reason`），调用方只有一套分支。
 */
export async function sendJson<T>(
  path: string,
  method: JsonMethod,
  body: unknown,
  signal?: AbortSignal,
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-rv-locale": getActiveLocale(),
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return failedEnvelope("offline", OFFLINE_MESSAGE);
  }

  return readEnvelope<T>(response);
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return failedEnvelope(
      "upstream_unavailable",
      "服务器返回了看不懂的内容。稍后再试。",
    );
  }

  if (!looksLikeEnvelope(body)) {
    return failedEnvelope(
      "upstream_unavailable",
      "服务器返回了看不懂的内容。稍后再试。",
    );
  }

  return body as ApiEnvelope<T>;
}

export function inspectPath(username: string): string {
  return `/api/inspect/${encodeURIComponent(username)}`;
}

export function repoPath(owner: string, name: string): string {
  return `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

export function boardPath(id: BoardId): string {
  return `/api/board/${encodeURIComponent(id)}`;
}

/** 收录状态问的是「收录」，不是「上榜」—— 所以按 `owner/name` 查，不按主题查。 */
export function collectionStatusPath(fullName: string): string {
  return `/api/collection-status?repo=${encodeURIComponent(fullName)}`;
}

export function claimPath(fullName: string): string {
  const [owner, name] = fullName.split("/");
  return `/api/claim/${encodeURIComponent(owner ?? "")}/${encodeURIComponent(name ?? "")}`;
}

export function claimsPath(): string {
  return "/api/claims";
}

export function takedownPath(): string {
  return "/api/takedown";
}

export function takedownTicketPath(ticket: string): string {
  return `/api/takedown/${encodeURIComponent(ticket)}`;
}
