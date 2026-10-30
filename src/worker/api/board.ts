/**
 * `GET /api/board/:board`
 *
 * 榜单**只读 D1**，不打 GitHub —— 收录是 Cron 的事，展示是这条路由的事。
 * 两个直接后果：
 *   - 榜单的 `readAt` 是这次查询的时刻，不是某个上游响应的时刻；
 *   - 收录还没跑过时，它是**空的**，不是失败的。空与失败由 `completeness` 分开。
 *
 * 缓存命中与 `/api/inspect` 同一条规则：过期了先给旧信封，后台刷新。
 */

import type { BoardId, BoardPayload, Envelope, RepoSummary } from "@/shared/contract";
import { t, type Locale } from "@/shared/i18n";
import { boardLabel, isBoardId } from "@/shared/ids";
import { THRESHOLDS } from "@/shared/thresholds";
import { repoTopicsLabel } from "@/shared/topic";
import { BOARD_CACHE_TTL_SECONDS, boardCacheKey, isExpired } from "@/worker/cache/ttl";
import { cacheGet, cacheSet } from "@/worker/cache/store";
import { delistedNoTopicSince, listForBoard } from "@/worker/db/collect-store";
import type { CollectedRepoRow } from "@/worker/db/schema";
import { toBool } from "@/worker/db/schema";
import { toRepoSummary } from "@/worker/derive/summary";
import type { Env, ExecutionContextLike } from "@/worker/env";
import type { GitHubRepo } from "@/worker/github/users";
import { jsonEnvelope, jsonError, makeError } from "./respond";

const DAY_MS = 86_400_000;
/** 一张榜单最多多少行。名次在 50 名之后对任何人都没有意义。 */
const BOARD_LIMIT = 50;
/** 「最近离开了多少」的统计窗口。 */
const DELISTED_WINDOW_DAYS = 30;

/**
 * 收录条件 —— 整句交给词典，数字来自 `THRESHOLDS`，主题名按语言拼接。
 * 三种榜单是三条**不同的整句**，不是把一句中文挖空再填数：语序随语言变。
 */
function criteriaFor(board: BoardId, topics: readonly string[], locale: Locale): string {
  const label = repoTopicsLabel(topics, locale);
  if (board === "embers") {
    return t(
      "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天、Star ≥ {stars}。",
      { topics: label, days: THRESHOLDS.emberMinDays, stars: THRESHOLDS.emberMinStars },
      locale,
    );
  }
  if (board === "forks") {
    return t(
      "收录条件：仓库带有 {topics} 主题，且是一个 Fork，沉睡 ≥ {days} 天。",
      { topics: label, days: THRESHOLDS.boardMinDormantDays },
      locale,
    );
  }
  return t(
    "收录条件：仓库带有 {topics} 主题，且沉睡 ≥ {days} 天。",
    { topics: label, days: THRESHOLDS.boardMinDormantDays },
    locale,
  );
}

/** D1 行 → 派生层认识的 `GitHubRepo`。字段名对不上的只有这一个方向。 */
function rowToRepo(row: CollectedRepoRow): GitHubRepo {
  let topics: string[] | null = null;
  if (row.topics_json !== null) {
    try {
      const parsed: unknown = JSON.parse(row.topics_json);
      topics = Array.isArray(parsed)
        ? parsed.filter((topic): topic is string => typeof topic === "string")
        : null;
    } catch {
      topics = null;
    }
  }

  return {
    name: row.name,
    full_name: row.full_name,
    owner: { login: row.owner, type: row.owner_type ?? undefined },
    description: row.description,
    language: row.language,
    stargazers_count: row.star_count,
    forks_count: row.fork_count,
    pushed_at: row.pushed_at,
    created_at: row.created_at,
    fork: toBool(row.is_fork),
    archived: toBool(row.archived),
    private: toBool(row.is_private) ?? undefined,
    topics,
  };
}

async function buildBoard(
  env: Env,
  board: BoardId,
  topics: readonly string[],
  locale: Locale,
): Promise<Envelope<BoardPayload>> {
  const readAt = new Date().toISOString();
  const minDays =
    board === "embers" ? THRESHOLDS.emberMinDays : THRESHOLDS.boardMinDormantDays;
  const cutoffIso = new Date(Date.now() - minDays * DAY_MS).toISOString();

  // `env.DB` 缺失是可诊断的部署问题，不是「没有仓库」。
  if (!env.DB) {
    throw new Error("d1:unbound");
  }

  const rows = await listForBoard(
    env.DB,
    board,
    cutoffIso,
    THRESHOLDS.emberMinStars,
    BOARD_LIMIT,
  );

  const entries = rows.map((row, index) => {
    const repo: RepoSummary = toRepoSummary(rowToRepo(row), readAt);
    return { rank: index + 1, repo, dormantDays: repo.dormantDays };
  });

  const since = new Date(Date.now() - DELISTED_WINDOW_DAYS * DAY_MS).toISOString();
  const delistedCount = await delistedNoTopicSince(env.DB, since);

  return {
    data: {
      id: board,
      name: boardLabel(board, locale).name,
      description: boardLabel(board, locale).description,
      criteria: criteriaFor(board, topics, locale),
      entries,
      delistedCount,
    },
    completeness: "complete",
    missingPages: [],
    readAt,
  };
}

export async function handleBoard(
  env: Env,
  ctx: ExecutionContextLike | undefined,
  rawBoard: string,
  topics: readonly string[],
  locale: Locale,
): Promise<Response> {
  const board = rawBoard.trim().toLowerCase();
  if (!isBoardId(board)) {
    return jsonError(makeError("invalid_board"), { topics, status: 400 });
  }

  // 语言进键：榜单里的名称、说明与收录条件都是**已翻译的句子**。
  const key = boardCacheKey(board, locale);
  const cached = await cacheGet(env.DB, key);

  if (cached) {
    try {
      const envelope = JSON.parse(cached.payload) as Envelope<BoardPayload>;
      if (!isExpired(cached.fetchedAt, BOARD_CACHE_TTL_SECONDS)) {
        return jsonEnvelope(envelope, { topics });
      }
      if (ctx) {
        ctx.waitUntil(
          buildBoard(env, board, topics, locale)
            .then((fresh) => cacheSet(env.DB, key, fresh, fresh.readAt ?? new Date().toISOString()))
            .catch(() => undefined),
        );
      }
      return jsonEnvelope(envelope, { topics });
    } catch {
      /* 缓存坏了 —— 当作未命中，往下实时查询。 */
    }
  }

  try {
    const envelope = await buildBoard(env, board, topics, locale);
    const written = cacheSet(env.DB, key, envelope, envelope.readAt ?? new Date().toISOString());
    if (ctx) ctx.waitUntil(written);
    else await written;
    return jsonEnvelope(envelope, { topics });
  } catch {
    /* 榜单读不到时**不能回空列表** —— 那会被读成「还没有仓库住进来」。
       这条路径上唯一会抛的就是 D1，所以文案说的是「读不到」，不是「连不上」。 */
    return jsonError(
      makeError("upstream_unavailable", {
        message: t("收录数据暂时读不到。稍后再试。", undefined, locale),
      }),
      { topics },
    );
  }
}
