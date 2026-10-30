/**
 * 一条上游仓库记录 → 收录结论。
 *
 * 纯函数，没有 IO，也不抛异常：三种结论分别是「确认可以收录」「确认不该收录」
 * 「这次无法确认」。第三种不是失败的同义词，也不许被当成第二种 ——
 * 读不到主题不等于没有主题。
 */

import type { DelistReason } from "@/worker/db/schema";
import type { GitHubRepo } from "@/worker/github/users";
import { normalizeTopic } from "@/shared/topic";

export type CollectOutcome =
  | { kind: "verified"; repo: GitHubRepo; enrolledTopic: string }
  | { kind: "delisted"; reason: DelistReason }
  | { kind: "unverified" };

/** 仓库自己带有的、归一化之后的主题。`null` = 这个字段没读到。 */
export function repoTopics(repo: GitHubRepo): string[] | null {
  if (!Array.isArray(repo.topics)) return null;
  return repo.topics
    .map((topic) => normalizeTopic(topic))
    .filter((topic): topic is string => topic !== null);
}

/**
 * 判定顺序刻意如此：
 *
 * 1. 私有 —— 即使搜到了也不该展示（防御：搜索只返回公开仓库）。
 * 2. 组织 —— 本站只收录个人公开仓库，这条在产品层就成立。
 * 3. 账号类型读不到 → `unverified`，不能假定是个人。
 * 4. 主题字段读不到 → `unverified`，不能假定没有主题。
 * 5. 命中任一配置主题 → 收录；否则 `no-topic`。
 */
export function classifyRepo(
  repo: GitHubRepo,
  topics: readonly string[],
): CollectOutcome {
  if (repo.private === true) return { kind: "delisted", reason: "private" };

  const ownerType = repo.owner?.type;
  if (ownerType === "Organization") return { kind: "delisted", reason: "org" };
  if (ownerType !== "User") return { kind: "unverified" };

  const own = repoTopics(repo);
  if (own === null) return { kind: "unverified" };

  for (const topic of topics) {
    if (own.includes(topic)) {
      return { kind: "verified", repo, enrolledTopic: topic };
    }
  }

  return { kind: "delisted", reason: "no-topic" };
}
