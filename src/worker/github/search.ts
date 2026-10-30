/**
 * GitHub 仓库搜索 —— 收集中枢的发现入口。
 *
 * 只问「带了某个主题的仓库有哪些」，不解释结果。搜索结果**本身就是一次核实**：
 * 每一项都带 `private` / `owner.type` / `topics` / `pushed_at` / Star 数，
 * 收一条不需要再补一次单仓库请求。
 */

import { githubFetch, hasNextPage } from "./client";
import { SEARCH_PAGE_SIZE } from "@/worker/collect/budget";
import type { GitHubRepo } from "./users";

export interface GitHubSearchResponse {
  total_count?: number;
  incomplete_results?: boolean;
  items?: GitHubRepo[];
}

export interface SearchPage {
  items: GitHubRepo[];
  /** 上游报的总数；读不到是 `null`。 */
  totalCount: number | null;
  /** 上游说这次结果本身可能不全（搜索服务的已知行为）。 */
  incomplete: boolean;
  hasNext: boolean;
}

/**
 * 按主题搜索，`updated` 降序 —— 最近有动静的排在前面。
 *
 * 排序不是「最新收录优先」，而是「最近被碰过的优先」：一轮一轮往后翻，
 * 沉睡已久的仓库最终也会被翻到，而刚加主题的仓库下一轮就能看见。
 */
export async function searchReposByTopic(
  env: { GITHUB_API_TOKEN?: string },
  topic: string,
  page: number,
  options: { signal?: AbortSignal } = {},
): Promise<SearchPage> {
  const query = new URLSearchParams({
    q: `topic:${topic}`,
    sort: "updated",
    order: "desc",
    per_page: String(SEARCH_PAGE_SIZE),
    page: String(page),
  });

  const response = await githubFetch<GitHubSearchResponse>(
    env,
    `/search/repositories?${query.toString()}`,
    options,
  );

  const data = response.data ?? {};
  return {
    items: Array.isArray(data.items) ? data.items : [],
    totalCount: typeof data.total_count === "number" ? data.total_count : null,
    incomplete: data.incomplete_results === true,
    hasNext: hasNextPage(response.headers),
  };
}
