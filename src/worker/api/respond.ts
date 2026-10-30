/**
 * 信封 → HTTP 响应，以及上游失败 → 产品错误码的唯一翻译处。
 *
 * 两条规则写在这里，别处不需要再重复：
 *   - `failed` 信封的 `data` 与 `readAt` 恒为 `null` —— 失败的读取没有读取时间。
 *   - 每个响应都带 `x-repo-topics`，让「SPA 与 Worker 配的主题不一样」一次 curl
 *     就能发现。
 */

import type { ApiError, Envelope, ErrorCode, ErrorEnvelope } from "@/shared/contract";
import { GitHubError } from "@/worker/github/client";

/** 服务端下发的文案。客户端原样渲染，不自己再拼一句。 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  rate_limited: "GitHub 暂时限制了这次读取的频率。稍后再试。",
  upstream_timeout: "读取 GitHub 超时了。稍后再试。",
  upstream_unavailable: "暂时连不上 GitHub。",
  account_not_found: "没有找到这个 GitHub 账户。",
  account_is_organization: "这是一个组织账户。本站只收录个人公开仓库。",
  repo_unavailable: "这个仓库读不到，可能已被删除或转为私有。",
  repo_delisted: "这个仓库已经不在本站展示了。",
  card_render_failed: "分享卡片暂时画不出来。",
  auth_failed: "登录没有完成。",
  claim_rejected: "这次认领没有通过。",
  client_unsupported: "这个接口还没有上线。",
  offline: "看起来你现在没有联网。连上网络后再试。",
  invalid_username: "用户名不太对。GitHub 用户名由字母、数字和单个连字符组成。",
  invalid_board: "没有这个榜单。",
  invalid_payload: "请求的内容不对。",
  payload_too_large: "请求的内容太大了。",
};

export function makeError(
  code: ErrorCode,
  extra: Partial<Pick<ApiError, "retryAfter" | "reason">> & { message?: string } = {},
): ApiError {
  const { message, ...rest } = extra;
  return { code, message: message ?? ERROR_MESSAGES[code], ...rest };
}

export function errorEnvelope(error: ApiError): ErrorEnvelope {
  return { data: null, completeness: "failed", missingPages: [], readAt: null, error };
}

const HTTP_STATUS: Partial<Record<ErrorCode, number>> = {
  invalid_username: 400,
  invalid_board: 400,
  invalid_payload: 400,
  payload_too_large: 413,
  account_not_found: 404,
  repo_unavailable: 404,
  repo_delisted: 410,
  account_is_organization: 422,
  rate_limited: 429,
  upstream_timeout: 504,
  upstream_unavailable: 503,
  auth_failed: 401,
  claim_rejected: 403,
  card_render_failed: 500,
  client_unsupported: 501,
};

export function statusFor(code: ErrorCode): number {
  return HTTP_STATUS[code] ?? 500;
}

export interface RespondOptions {
  topics: readonly string[];
  status?: number;
}

export function jsonEnvelope(
  envelope: Envelope<unknown>,
  { topics, status = 200 }: RespondOptions,
): Response {
  return new Response(JSON.stringify(envelope), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-repo-topics": topics.join(","),
    },
  });
}

export function jsonError(error: ApiError, options: RespondOptions): Response {
  return jsonEnvelope(errorEnvelope(error), {
    ...options,
    status: options.status ?? statusFor(error.code),
  });
}

/**
 * 上游失败 → 产品错误。`not-found` 的翻译因调用方而异（账户还是仓库），
 * 所以这里只处理与调用方无关的那几种，剩下的由调用方先判断。
 */
export function fromGitHubError(
  error: unknown,
  notFoundCode: ErrorCode = "upstream_unavailable",
): ApiError {
  if (!(error instanceof GitHubError)) {
    return makeError("upstream_unavailable");
  }
  switch (error.kind) {
    case "rate-limited":
      return makeError("rate_limited", { retryAfter: error.retryAfter });
    case "timeout":
      return makeError("upstream_timeout");
    case "not-found":
      return makeError(notFoundCode);
    case "unconfigured":
      return makeError(
        "upstream_unavailable",
        { message: "站点还没有配置读取 GitHub 用的令牌，暂时读不到数据。" },
      );
    default:
      return makeError("upstream_unavailable");
  }
}
