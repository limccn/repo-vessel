/**
 * 原始仓库 → `RepoSummary`。
 *
 * 全部派生都在 Worker 完成，客户端只渲染（`.trellis/spec/frontend/type-safety.md`）。
 * 这里有一条贯穿整层的规则：**读不到就是 `null`，不是 0，也不是「普通」。**
 */

import type { RepoSummary, TagId, Upstream } from "@/shared/contract";
import { TAG_ORDER } from "@/shared/ids";
import { THRESHOLDS } from "@/shared/thresholds";
import { normalizeTopic } from "@/shared/topic";
import type { GitHubRepo } from "@/worker/github/users";

const DAY_MS = 86_400_000;

/** 沉睡天数 = 最后推送到现在（本次读取时刻）的整天数。 */
export function dormantDaysOf(
  pushedAt: string | null | undefined,
  readAt: string,
): number | null {
  if (!pushedAt) return null;
  const pushed = Date.parse(pushedAt);
  const read = Date.parse(readAt);
  if (Number.isNaN(pushed) || Number.isNaN(read)) return null;
  return Math.max(0, Math.floor((read - pushed) / DAY_MS));
}

/** 一条标签的判定输入。任何一个字段是 `null` 都意味着「不知道」，不产出标签。 */
export interface TagInput {
  dormantDays: number | null;
  starCount: number | null;
  isFork: boolean | null;
  archived: boolean | null;
}

/**
 * 沉睡标签、余烬、Fork、归档，按 `TAG_ORDER` 排序。
 *
 * 「余烬未熄」要求两天数**和** Star 都读到了才给 —— 少一个就说「有余烬」，
 * 等于替上游编了一个数字。
 */
export function tagsOf(input: TagInput): TagId[] {
  const tags = new Set<TagId>();
  const { dormantDays, starCount, isFork, archived } = input;

  if (dormantDays !== null) {
    if (dormantDays >= THRESHOLDS.capsuleMinDays) tags.add("capsule");
    else if (dormantDays >= THRESHOLDS.standbyMinDays) tags.add("standby");
    else if (dormantDays >= THRESHOLDS.quietMinDays) tags.add("quiet");

    if (
      dormantDays >= THRESHOLDS.emberMinDays &&
      starCount !== null &&
      starCount >= THRESHOLDS.emberMinStars
    ) {
      tags.add("ember");
    }
  }

  if (isFork === true) tags.add("fork");
  if (archived === true) tags.add("archived");

  return TAG_ORDER.filter((tag) => tags.has(tag));
}

/**
 * Fork 上游三态。
 *
 * - 非 Fork → `null`（不适用 ≠ 未知）
 * - 拿不到 `parent` → `unresolved`（不知道它从哪来）
 * - 上游是组织 → `org`，且 `lastPushedAt` 恒为 `null`：组织仓库不被本站读取
 * - 上游是个人 → `personal`
 */
export function upstreamOf(repo: GitHubRepo): Upstream | null {
  if (repo.fork !== true) return null;

  const parent = repo.parent;
  if (!parent) {
    return { state: "unresolved", owner: null, repo: null, lastPushedAt: null, reachable: false };
  }

  const owner = parent.owner?.login ?? null;
  const name = parent.name ?? null;
  if (!owner || !name) {
    return { state: "unresolved", owner: null, repo: null, lastPushedAt: null, reachable: false };
  }

  if (parent.owner?.type === "Organization") {
    return { state: "org", owner, repo: name, lastPushedAt: null, reachable: true };
  }

  if (parent.owner?.type === "User") {
    return {
      state: "personal",
      owner,
      repo: name,
      lastPushedAt: parent.pushed_at ?? null,
      reachable: true,
    };
  }

  return { state: "unresolved", owner, repo: name, lastPushedAt: null, reachable: false };
}

/** 主题：读不到是 `null`，确实为空才是 `[]`。 */
export function topicsOf(repo: GitHubRepo): string[] | null {
  if (!Array.isArray(repo.topics)) return null;
  return repo.topics
    .map((topic) => normalizeTopic(topic))
    .filter((topic): topic is string => topic !== null);
}

/** 数字字段：非有限数字一律当作未知。 */
function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toRepoSummary(repo: GitHubRepo, readAt: string): RepoSummary {
  const pushedAt = repo.pushed_at ?? null;
  const dormantDays = dormantDaysOf(pushedAt, readAt);
  const starCount = numberOrNull(repo.stargazers_count);
  const isFork = typeof repo.fork === "boolean" ? repo.fork : null;
  const archived = typeof repo.archived === "boolean" ? repo.archived : null;

  return {
    owner: repo.owner?.login ?? "",
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? null,
    language: repo.language ?? null,
    starCount,
    forkCount: numberOrNull(repo.forks_count),
    pushedAt,
    createdAt: repo.created_at ?? null,
    isFork,
    archived,
    topics: topicsOf(repo),
    dormantDays,
    tags: tagsOf({ dormantDays, starCount, isFork, archived }),
    upstream: upstreamOf(repo),
  };
}
