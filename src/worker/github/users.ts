/**
 * GitHub 的账户与仓库读取。
 *
 * 这里只有「怎么问上游」，没有「怎么解释」。解释在 `derive/`，产品错误在 `api/`。
 *
 * 分页的三条硬规则（M1 design §5）：
 *   1. `type=owner` —— 只要这个人自己的仓库，排除仅作为协作者出现的。
 *   2. 页数上限 `THRESHOLDS.maxRepos / 100`，超出就是 `truncated`，如实报告。
 *   3. 翻页看 `Link` 头，不靠「本页不足 100 条」猜 —— 上游会少给。
 */

import { THRESHOLDS } from "@/shared/thresholds";
import { GitHubError, githubFetch, hasNextPage } from "./client";

export interface GitHubUser {
  login: string;
  type: string;
  avatar_url?: string | null;
}

export interface GitHubOwner {
  login: string;
  type?: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  owner: GitHubOwner;
  description?: string | null;
  language?: string | null;
  stargazers_count?: number | null;
  forks_count?: number | null;
  pushed_at?: string | null;
  created_at?: string | null;
  fork?: boolean | null;
  archived?: boolean | null;
  private?: boolean;
  topics?: string[] | null;
  /** 只有 Fork 才有；列表接口不一定给。给了就不额外请求。 */
  parent?: GitHubRepo | null;
}

export const PAGE_SIZE = 100;
export const MAX_PAGES = Math.ceil(THRESHOLDS.maxRepos / PAGE_SIZE);

/** 一次账户读取的结果 —— 「读到了什么」与「没读到什么」分开陈述。 */
export interface RepoRead {
  repos: GitHubRepo[];
  /** 读失败的页号。空数组表示每一页都读到了。 */
  missingPages: number[];
  /** 到了页数上限还有下一页 —— 这个账户的仓库比我们读的多。 */
  truncated: boolean;
}

/** 账户本身读不到时抛出；账户读到了、仓库页有失败时用 `RepoRead` 表达。 */
export async function getUser(
  env: { GITHUB_API_TOKEN?: string },
  login: string,
  options: { signal?: AbortSignal } = {},
): Promise<GitHubUser> {
  const { data } = await githubFetch<GitHubUser>(
    env,
    `/users/${encodeURIComponent(login)}`,
    options,
  );
  return data;
}

/**
 * 读一个用户的公开仓库。
 *
 * 排序是 `pushed asc` —— **最久没有推送的排在前面**。这样页数上限截断时丢掉的是
 * 最近活跃的那批，而产品最核心的「最长沉睡」仍然可信。代价是截断后那些
 * 「可能还有更多」的统计必须置为未知，见 `derive/stats.ts`。
 */
export async function listOwnedRepos(
  env: { GITHUB_API_TOKEN?: string },
  login: string,
  options: { signal?: AbortSignal } = {},
): Promise<RepoRead> {
  const repos: GitHubRepo[] = [];
  const missingPages: number[] = [];
  let truncated = false;
  let firstError: GitHubError | null = null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let response;
    try {
      response = await githubFetch<GitHubRepo[]>(
        env,
        `/users/${encodeURIComponent(login)}/repos` +
          `?type=owner&sort=pushed&direction=asc&per_page=${PAGE_SIZE}&page=${page}`,
        options,
      );
    } catch (error) {
      const failure =
        error instanceof GitHubError ? error : new GitHubError("unavailable", 502);
      firstError ??= failure;

      // 这些失败不会因为翻到下一页就变好：继续只会多烧配额、多花时间。
      if (
        failure.kind === "rate-limited" ||
        failure.kind === "timeout" ||
        failure.kind === "unconfigured"
      ) {
        for (let rest = page; rest <= MAX_PAGES; rest += 1) missingPages.push(rest);
        break;
      }
      missingPages.push(page);
      continue;
    }

    const pageRepos = Array.isArray(response.data) ? response.data : [];
    repos.push(...pageRepos.filter((repo) => repo.private !== true));

    if (!hasNextPage(response.headers)) break;
    if (page === MAX_PAGES) truncated = true;
  }

  // 一页都没读成 → 这是「账户读到了但仓库全失败」，仍然是失败。
  if (repos.length === 0 && missingPages.length === MAX_PAGES && firstError) {
    throw firstError;
  }

  return { repos, missingPages, truncated };
}
