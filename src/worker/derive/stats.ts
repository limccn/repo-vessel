/**
 * 统计与收录数。
 *
 * 这里唯一的难点不是加法，而是**什么时候不该给数字**。
 *
 * 读取按 `pushed asc` 进行（最久未推送的在前），所以页数上限截断时丢掉的是
 * 最近活跃的那批仓库 —— 于是：
 *
 *   - `longestDormantDays` 仍然可信（最沉睡的已经读到）；
 *   - 其余依赖「完整集合」的计数一律 `null`。
 *
 * 半真半假的数字比没有数字更糟：一个少算了的「余烬 3 个」会被当成事实转述。
 */

import type { InspectPayload } from "@/shared/contract";
import type { RepoSummary } from "@/shared/contract";

export interface CountInput {
  repos: RepoSummary[];
  /** 站点配置的主题列表。 */
  topics: readonly string[];
  /** 每一页都读到了，且没有触到页数上限。 */
  complete: boolean;
}

export interface Counts {
  repoCount: number | null;
  enrolledCount: number | null;
  stats: InspectPayload["stats"];
}

/** 集合里有一个「不知道」时，计数就只能是不知道。 */
function countWhere(
  repos: RepoSummary[],
  predicate: (repo: RepoSummary) => boolean | null,
): number | null {
  let count = 0;
  for (const repo of repos) {
    const hit = predicate(repo);
    if (hit === null) return null;
    if (hit) count += 1;
  }
  return count;
}

export function longestDormantOf(repos: RepoSummary[]): number | null {
  let longest: number | null = null;
  for (const repo of repos) {
    if (repo.dormantDays === null) continue;
    if (longest === null || repo.dormantDays > longest) longest = repo.dormantDays;
  }
  return longest;
}

export function buildCounts({ repos, topics, complete }: CountInput): Counts {
  const longestDormantDays = longestDormantOf(repos);

  if (!complete) {
    return {
      repoCount: null,
      enrolledCount: null,
      stats: {
        longestDormantDays,
        emberCount: null,
        forkCount: null,
        archivedCount: null,
      },
    };
  }

  const enrolledCount = countWhere(repos, (repo) => {
    if (repo.topics === null) return null;
    return repo.topics.some((topic) => topics.includes(topic));
  });

  return {
    repoCount: repos.length,
    enrolledCount,
    stats: {
      longestDormantDays,
      emberCount: countWhere(repos, (repo) => repo.tags.includes("ember")),
      forkCount: countWhere(repos, (repo) => repo.isFork),
      archivedCount: countWhere(repos, (repo) => repo.archived),
    },
  };
}
