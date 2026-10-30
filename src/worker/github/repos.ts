/**
 * 单个仓库的读取，以及 Fork 上游的补读。
 *
 * `/api/repos/:owner/:repo` 直接用它；`/api/inspect/:username` 用它补 Fork 的
 * `parent` —— GitHub 的**列表**接口不返回 `parent`，只有单仓库响应才带。
 */

import { githubFetch } from "./client";
import type { GitHubRepo } from "./users";

/**
 * 一次账户查询里最多补读多少个 Fork 的上游。
 *
 * 列表按 `pushed asc` 排好，所以拿到的是**最沉睡的**那批，正好是产品最关心的。
 * 25 与「1 次账户 + 10 页列表」相加不超过 Workers 每请求 50 个子请求的预算。
 * 超出的 Fork 保持 `unresolved` —— 「不知道它从哪来」是真话，不是缺省值。
 */
export const MAX_UPSTREAM_LOOKUPS = 25;

/** 同时进行的补读数。GitHub 的 secondary rate limit 不喜欢突发，但 8 路远低于它的上限。 */
const UPSTREAM_CONCURRENCY = 8;

/** 404 由调用方翻译成 `repo_unavailable` —— 这里不替它下结论。 */
export async function getRepo(
  env: { GITHUB_API_TOKEN?: string },
  owner: string,
  name: string,
  options: { signal?: AbortSignal } = {},
): Promise<GitHubRepo> {
  const { data } = await githubFetch<GitHubRepo>(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    options,
  );
  return data;
}

/**
 * 给列表里缺 `parent` 的 Fork 补读上游，**原地**挂回 `repo.parent`。
 *
 * 补读失败不改变这次读取的 `completeness`：上游信息缺失是仓库自身的一个字段
 * 读不到，不是这次读取少了东西 —— `unresolved` 已经是「不知道」的表达。
 */
export async function resolveUpstreams(
  env: { GITHUB_API_TOKEN?: string },
  repos: GitHubRepo[],
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  const forks = repos
    .filter((repo) => repo.fork === true && repo.parent == null && repo.owner?.login)
    .slice(0, MAX_UPSTREAM_LOOKUPS);

  if (forks.length === 0) return;

  let next = 0;
  const run = async (): Promise<void> => {
    for (;;) {
      const fork = forks[next];
      next += 1;
      if (fork === undefined) return;

      try {
        const detail = await getRepo(env, fork.owner.login, fork.name, options);
        fork.parent = detail.parent ?? null;
      } catch {
        /* 保持 unresolved —— 读不到来处时，「不知道」就是全部事实。 */
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(UPSTREAM_CONCURRENCY, forks.length) }, run),
  );
}
