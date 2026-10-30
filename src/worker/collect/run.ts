/**
 * 收集中枢 —— 每六小时一轮。
 *
 * 两件事：**发现**（按配置主题搜索）与**复核**（把已收录的仓库再读一次）。
 * 搜索结果本身带齐了判定要用的字段，所以发现阶段一条仓库不需要额外请求；
 * 复核阶段才逐条读单仓库响应，确认它现在还是公开、个人、还带主题。
 *
 * 三条必须一直成立的规则：
 *   1. 一次运行有预算。跑不完就存游标，下一轮接着跑。
 *   2. 单条失败不终止整轮；限流终止本轮（继续只会全部失败）。
 *   3. 读不到 ≠ 不该展示。无法确认的仓库先保持原状态，连续失败到阈值才离开榜单。
 */

import { resolveRepoTopicList } from "@/shared/topic";
import { invalidateBoards } from "@/worker/cache/invalidate";
import { pruneCache } from "@/worker/cache/store";
import {
  listToVerify,
  loadCursor,
  markDelisted,
  readCollected,
  recordVerifyFailure,
  saveCursor,
  upsertVerified,
  type CollectedRepoInput,
} from "@/worker/db/collect-store";
import { recordMetric } from "@/worker/db/metrics-store";
import { normalizeFullName, type CollectionCursor, type DelistReason } from "@/worker/db/schema";
import type { Env } from "@/worker/env";
import { GitHubError } from "@/worker/github/client";
import { getRepo } from "@/worker/github/repos";
import { searchReposByTopic } from "@/worker/github/search";
import type { GitHubRepo } from "@/worker/github/users";
import {
  MAX_SEARCH_PAGES,
  MAX_VERIFY_FAILURES,
  SEARCH_BUDGET,
  VERIFY_BUDGET,
  VERIFY_CONCURRENCY,
} from "./budget";
import { classifyRepo } from "./classify";

/** 缓存打扫：比任何 TTL 都旧的条目留着也不会有命中。 */
const CACHE_RETENTION_MS = 7 * 86_400_000;

export interface CollectionRunSummary {
  /** 发出了多少次搜索请求。 */
  searches: number;
  /** 搜索里看到的仓库条数（含已存在的）。 */
  discovered: number;
  /** 复核读了几条。 */
  verifiedReads: number;
  /** 确认下架的条数（发现阶段 + 复核阶段）。 */
  delisted: number;
  /** 没能确认的条数。 */
  unconfirmed: number;
  /** 一行人类可读的摘要，存进游标，排查时 `wrangler d1 execute` 就能看到。 */
  summary: string;
}

function freshCursor(now: string): CollectionCursor {
  return { topicIndex: 0, page: 1, cycle: 0, startedAt: now, lastRunAt: now, lastSummary: "" };
}

/** 前进一步：还有下一页就翻页，否则换主题；绕回第一个主题算完成一轮。 */
function advance(cursor: CollectionCursor, topicCount: number, hasNext: boolean): void {
  if (hasNext && cursor.page < MAX_SEARCH_PAGES) {
    cursor.page += 1;
    return;
  }
  cursor.topicIndex = (cursor.topicIndex + 1) % topicCount;
  cursor.page = 1;
  if (cursor.topicIndex === 0) cursor.cycle += 1;
}

/** 上游仓库 → 存储输入。全名小写；展示用的 owner / name 也小写，两列本来就只做索引。 */
function toInput(repo: GitHubRepo, enrolledTopic: string, seenAt: string): CollectedRepoInput | null {
  const fullName = normalizeFullName(repo.full_name ?? "");
  if (fullName === null) return null;
  const [owner, name] = fullName.split("/") as [string, string];

  return {
    fullName,
    owner,
    name,
    ownerType: repo.owner?.type ?? null,
    isPrivate: typeof repo.private === "boolean" ? repo.private : null,
    isFork: typeof repo.fork === "boolean" ? repo.fork : null,
    archived: typeof repo.archived === "boolean" ? repo.archived : null,
    starCount: numberOrNull(repo.stargazers_count),
    forkCount: numberOrNull(repo.forks_count),
    pushedAt: repo.pushed_at ?? null,
    createdAt: repo.created_at ?? null,
    description: repo.description ?? null,
    language: repo.language ?? null,
    topics: Array.isArray(repo.topics) ? repo.topics : null,
    enrolledTopic,
    seenAt,
  };
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 上限 `limit` 路并发，顺序消费。比一次 `Promise.all` 稳，也不会攒出二级限流。 */
async function eachWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const item = items[next];
      next += 1;
      if (item === undefined) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function isRateLimited(error: unknown): boolean {
  return error instanceof GitHubError && error.kind === "rate-limited";
}

/**
 * 跑一轮。没有 DB 或没有读取令牌时直接返回 `null` —— 部署残缺时不该每六小时
 * 报一次错，也不该留下半条数据。
 */
export async function runCollection(env: Env): Promise<CollectionRunSummary | null> {
  const db = env.DB;
  if (!db || !env.GITHUB_API_TOKEN?.trim()) return null;

  const topics = resolveRepoTopicList(env.REPO_TOPICS);
  const now = new Date().toISOString();
  const cursor = (await loadCursor(db)) ?? freshCursor(now);
  const seen = new Set<string>();

  let searches = 0;
  let discovered = 0;
  let delisted = 0;
  let unconfirmed = 0;
  let visibilityChanged = false;

  /* --------------------------------------------------------------- 发现 */

  while (searches < SEARCH_BUDGET) {
    const topic = topics[cursor.topicIndex % topics.length];
    if (topic === undefined) break;
    searches += 1;

    let page;
    try {
      page = await searchReposByTopic(env, topic, cursor.page);
    } catch (error) {
      if (isRateLimited(error)) break;
      // 超时 / 不可用：跳过这一页，别让同一页卡住整轮。
      advance(cursor, topics.length, true);
      continue;
    }

    discovered += page.items.length;

    for (const item of page.items) {
      const outcome = classifyRepo(item, topics);

      if (outcome.kind === "verified") {
        const input = toInput(outcome.repo, outcome.enrolledTopic, now);
        if (input === null) continue;
        seen.add(input.fullName);
        await upsertVerified(db, input);
        continue;
      }

      const fullName = normalizeFullName(item.full_name ?? "");
      if (fullName === null) continue;

      if (outcome.kind === "delisted") {
        // 只有已经存在的行才需要改状态；没入过龛的仓库下架无从谈起。
        if (await readCollected(db, fullName)) {
          await markDelisted(db, fullName, outcome.reason as DelistReason, now);
          delisted += 1;
          visibilityChanged = true;
        }
      } else if (await readCollected(db, fullName)) {
        await recordVerifyFailure(db, fullName, now, MAX_VERIFY_FAILURES);
        unconfirmed += 1;
        visibilityChanged = true;
      }
    }

    advance(cursor, topics.length, page.hasNext);
  }

  /* --------------------------------------------------------------- 复核 */

  const candidates = (await listToVerify(db, VERIFY_BUDGET * 2))
    .filter((row) => !seen.has(row.full_name))
    .slice(0, VERIFY_BUDGET);

  let verifiedReads = 0;
  /* 一旦限流，后面的每一条都会以同样的方式失败。继续读只会把一批本来正常的
     仓库一起推过失败阈值 —— 限流是我们读不到，不是仓库出了问题。 */
  let rateLimited = false;

  await eachWithConcurrency(candidates, VERIFY_CONCURRENCY, async (row) => {
    if (rateLimited) return;
    verifiedReads += 1;
    try {
      const repo = await getRepo(env, row.owner, row.name);
      const outcome = classifyRepo(repo, topics);

      if (outcome.kind === "verified") {
        const input = toInput(outcome.repo, outcome.enrolledTopic, now);
        if (input) await upsertVerified(db, input);
        return;
      }

      if (outcome.kind === "delisted") {
        await markDelisted(db, row.full_name, outcome.reason, now);
        delisted += 1;
        visibilityChanged = true;
        return;
      }

      await recordVerifyFailure(db, row.full_name, now, MAX_VERIFY_FAILURES);
      unconfirmed += 1;
      visibilityChanged = true;
    } catch (error) {
      if (isRateLimited(error)) {
        rateLimited = true;
        return;
      }
      /* 404 对「已删除」与「已转私有」都成立，两者都不该再展示 —— 下架，
         但理由只记 `private`（内部字段，界面上说的是「读不到了」）。 */
      if (error instanceof GitHubError && error.kind === "not-found") {
        await markDelisted(db, row.full_name, "private", now);
        delisted += 1;
        visibilityChanged = true;
        return;
      }
      // 超时 / 不可用：记一次「没确认」，连续失败到阈值才离开榜单。
      await recordVerifyFailure(db, row.full_name, now, MAX_VERIFY_FAILURES);
      unconfirmed += 1;
      visibilityChanged = true;
    }
  });

  if (visibilityChanged) await invalidateBoards(db);
  await pruneCache(db, new Date(Date.now() - CACHE_RETENTION_MS).toISOString());

  const summary =
    `搜索 ${searches} 页、发现 ${discovered} 条；复核 ${verifiedReads} 条` +
    `（下架 ${delisted}、未确认 ${unconfirmed}）`;

  cursor.lastRunAt = now;
  cursor.lastSummary = summary;
  await saveCursor(db, cursor);

  /* 状态核实失败率 = unconfirmed ÷（verifiedReads + unconfirmed）。
     这里记录的是本轮的增量，不是累计值 —— 报告按窗口求和。 */
  await recordMetric(env, "collect_run", "searches", searches);
  await recordMetric(env, "collect_run", "discovered", discovered);
  await recordMetric(env, "collect_run", "verified_reads", verifiedReads);
  await recordMetric(env, "collect_run", "delisted", delisted);
  await recordMetric(env, "collect_run", "unconfirmed", unconfirmed);

  return { searches, discovered, verifiedReads, delisted, unconfirmed, summary };
}
