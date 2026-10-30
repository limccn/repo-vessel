/**
 * 全仓库**唯一**的 `api.github.com` 调用点。
 *
 * 这一层只负责：认证头、UA、超时、限流与状态码归类。它不认识「账户」「仓库」
 * 「称号」—— 那些属于 `github/users.ts`、`github/repos.ts` 与 `derive/`。
 *
 * 失败用 `GitHubError` 表达，且只表达**上游发生了什么**（`kind`）。把它翻译成
 * 产品错误码是 API 层的事：同样是 404，查账户是 `account_not_found`，查仓库
 * 是 `repo_unavailable`。
 */

import { THRESHOLDS } from "@/shared/thresholds";

const API_BASE = "https://api.github.com";

/** 上游失败的四种形态。`unconfigured` 是我们自己的问题，不是上游的。 */
export type GitHubFailureKind =
  | "not-found"
  | "rate-limited"
  | "timeout"
  | "unavailable"
  | "unconfigured";

export class GitHubError extends Error {
  constructor(
    readonly kind: GitHubFailureKind,
    readonly status: number,
    /** Epoch 秒。只有 `rate-limited` 有。 */
    readonly retryAfter?: number,
  ) {
    super(`github:${kind}:${status}`);
    this.name = "GitHubError";
  }
}

export interface GitHubRequestOptions {
  /** 调用方自己的取消信号（页面离开、上游已给出失败）。 */
  signal?: AbortSignal;
}

export interface GitHubResponse<T> {
  data: T;
  /** 原始响应头里我们关心的那几个。 */
  headers: Headers;
  /** `false` 表示 304，`data` 为 `null`。 */
  ok: boolean;
}

/**
 * 发一个 GitHub 请求。
 *
 * 缺 `GITHUB_API_TOKEN` 时抛 `unconfigured` —— **绝不回落匿名请求**。匿名配额
 * 是每 IP 每小时 60 次，而 Workers 的出口 IP 与他人共享，回落只会让线上表现成
 * 「时好时坏」，比明确失败更难排查。
 */
export async function githubFetch<T>(
  env: { GITHUB_API_TOKEN?: string },
  path: string,
  options: GitHubRequestOptions = {},
): Promise<GitHubResponse<T>> {
  const token = env.GITHUB_API_TOKEN?.trim();
  if (!token) {
    throw new GitHubError("unconfigured", 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), THRESHOLDS.hardTimeoutMs);
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onOuterAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "repo-vessel (+https://repovessel.lmlh.net)",
      },
      signal: controller.signal,
    });
  } catch (error) {
    // 超时与「调用方取消」都走 abort；调用方取消不该被说成上游超时，
    // 但那是调用方的事 —— 这里只把 abort 归为 timeout，外层会用 signal.aborted
    // 区分。
    if (options.signal?.aborted) {
      throw new GitHubError("timeout", 499);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new GitHubError("timeout", 504);
    }
    throw new GitHubError("unavailable", 502);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }

  if (response.status === 304) {
    return { data: null as T, headers: response.headers, ok: false };
  }

  if (response.ok) {
    return { data: (await response.json()) as T, headers: response.headers, ok: true };
  }

  if (response.status === 404) {
    throw new GitHubError("not-found", 404);
  }

  if (response.status === 403 || response.status === 429) {
    /* 两种 403：配额用尽（remaining=0）与滥用检测（secondary rate limit）。
       两者都该按「稍后再试」处理，区别只在 retryAfter 从哪个头来 ——
       `Retry-After`（秒）优先，其次 `x-ratelimit-reset`（epoch 秒）。 */
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    const retryAfter = Number(response.headers.get("retry-after"));
    const fromReset = Number.isFinite(reset) && reset > 0 ? reset : undefined;
    const fromHeader = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
    throw new GitHubError("rate-limited", 429, fromHeader ?? fromReset);
  }

  throw new GitHubError("unavailable", response.status >= 500 ? 502 : 500);
}

/** `Link: <...>; rel="next"` 是否有下一页。不靠「本页不足 100 条」猜。 */
export function hasNextPage(headers: Headers): boolean {
  const link = headers.get("link");
  return Boolean(link && /rel="next"/.test(link));
}
