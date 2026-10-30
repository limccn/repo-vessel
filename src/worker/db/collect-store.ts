/**
 * `collected_repo` 与 `collection_state` 的读写。
 *
 * 两条不变式在这里落地：
 *   1. **一次成功的 upsert 不清 `hidden_by`。** 隐藏是所有者（或下架处理）的意思，
 *      不是上游元数据的一部分；Cron 每六小时重扫一遍，不能让隐藏自动失效。
 *   2. **复核失败不删行。** 失败只累加 `verify_failures`，到阈值才把状态改成
 *      `unverified` —— 那不是「已下架」，是「这次没确认」。
 *
 * 这里的读写**不吞异常**：榜单接口要凭它区分「没有仓库」与「读不到」。
 * 只有游标（`loadCursor` / `saveCursor`）是旁路，失败降级成空游标。
 */

import type { BoardId } from "@/shared/contract";
import type { D1Like } from "@/worker/env";
import type {
  CollectedRepoRow,
  CollectionCursor,
  DelistReason,
  HiddenBy,
} from "./schema";
import { fromBool } from "./schema";

/** 一次发现 / 复核得到的仓库快照。字段全部来自 GitHub 的响应，不做推断。 */
export interface CollectedRepoInput {
  /** 小写 `owner/name`。见 `normalizeFullName()`。 */
  fullName: string;
  owner: string;
  name: string;
  ownerType: string | null;
  isPrivate: boolean | null;
  isFork: boolean | null;
  archived: boolean | null;
  starCount: number | null;
  forkCount: number | null;
  pushedAt: string | null;
  createdAt: string | null;
  description: string | null;
  language: string | null;
  topics: string[] | null;
  /** 命中的那个配置主题。`null` 表示这次没有命中（只用于历史记录）。 */
  enrolledTopic: string | null;
  /** 这次读到它的时刻。 */
  seenAt: string;
}

/**
 * 写入一条**已核实**的仓库。
 *
 * `ON CONFLICT` 一列一列写出来，而不是 `DO UPDATE SET *` —— 缺席的
 * `hidden_by` / `first_seen_at` 正是「重扫不复活、不改初遇时间」两条规则本身。
 */
export async function upsertVerified(db: D1Like, input: CollectedRepoInput): Promise<void> {
  await db
    .prepare(
      "INSERT INTO collected_repo (" +
        "full_name, owner, name, owner_type, is_private, is_fork, archived, " +
        "star_count, fork_count, pushed_at, created_at, description, language, topics_json, " +
        "enrolled_topic, verify_state, verify_failures, verified_at, " +
        "first_seen_at, last_seen_at, delisted_reason, delisted_at, hidden_by" +
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', 0, ?, ?, ?, NULL, NULL, NULL) " +
        "ON CONFLICT(full_name) DO UPDATE SET " +
        "owner = excluded.owner, name = excluded.name, owner_type = excluded.owner_type, " +
        "is_private = excluded.is_private, is_fork = excluded.is_fork, archived = excluded.archived, " +
        "star_count = excluded.star_count, fork_count = excluded.fork_count, " +
        "pushed_at = excluded.pushed_at, created_at = excluded.created_at, " +
        "description = excluded.description, " +
        "language = excluded.language, topics_json = excluded.topics_json, " +
        "enrolled_topic = excluded.enrolled_topic, verify_state = 'verified', " +
        "verify_failures = 0, verified_at = excluded.verified_at, " +
        "last_seen_at = excluded.last_seen_at, delisted_reason = NULL, delisted_at = NULL",
    )
    .bind(
      input.fullName,
      input.owner,
      input.name,
      input.ownerType,
      fromBool(input.isPrivate),
      fromBool(input.isFork),
      fromBool(input.archived),
      input.starCount,
      input.forkCount,
      input.pushedAt,
      input.createdAt,
      input.description,
      input.language,
      input.topics === null ? null : JSON.stringify(input.topics),
      input.enrolledTopic,
      input.seenAt,
      input.seenAt,
      input.seenAt,
    )
    .run();
}

export async function readCollected(
  db: D1Like,
  fullName: string,
): Promise<CollectedRepoRow | null> {
  return db
    .prepare("SELECT * FROM collected_repo WHERE full_name = ?")
    .bind(fullName)
    .first<CollectedRepoRow>();
}

/** 上次成功核实最久远的那批，`null` 排最前 —— 它们最该被重看。 */
export async function listToVerify(
  db: D1Like,
  limit: number,
): Promise<CollectedRepoRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM collected_repo WHERE verify_state != 'delisted' " +
        "ORDER BY (verified_at IS NULL) DESC, verified_at ASC LIMIT ?",
    )
    .bind(limit)
    .all<CollectedRepoRow>();
  return result.results ?? [];
}

/**
 * 一次榜单查询。`board` 决定切片，`cutoffIso` 决定「多旧才算沉睡」。
 *
 * 三张榜单都只读 `verified` 且未隐藏的行 —— `unverified` 与 `delisted`
 * 在展示上等价，但在记录上是两件事，这里只认前者能上榜。
 */
export async function listForBoard(
  db: D1Like,
  board: BoardId,
  cutoffIso: string,
  emberMinStars: number,
  limit: number,
): Promise<CollectedRepoRow[]> {
  const base =
    "SELECT * FROM collected_repo " +
    "WHERE verify_state = 'verified' AND hidden_by IS NULL " +
    "AND pushed_at IS NOT NULL AND pushed_at <= ?";

  let result;
  if (board === "embers") {
    result = await db
      .prepare(
        `${base} AND star_count IS NOT NULL AND star_count >= ? ` +
          "ORDER BY star_count DESC, pushed_at ASC LIMIT ?",
      )
      .bind(cutoffIso, emberMinStars, limit)
      .all<CollectedRepoRow>();
  } else if (board === "forks") {
    result = await db
      .prepare(`${base} AND is_fork = 1 ORDER BY pushed_at ASC LIMIT ?`)
      .bind(cutoffIso, limit)
      .all<CollectedRepoRow>();
  } else {
    result = await db
      .prepare(`${base} ORDER BY pushed_at ASC LIMIT ?`)
      .bind(cutoffIso, limit)
      .all<CollectedRepoRow>();
  }
  return result.results ?? [];
}

/** 确认不该再展示的仓库。保留 `hidden_by` —— 隐藏是另一件事，不该被下架抹掉。 */
export async function markDelisted(
  db: D1Like,
  fullName: string,
  reason: DelistReason,
  at: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE collected_repo SET verify_state = 'delisted', delisted_reason = ?, " +
        "delisted_at = ?, last_seen_at = ? WHERE full_name = ?",
    )
    .bind(reason, at, at, fullName)
    .run();
}

/**
 * 记一次**无法确认**的复核。
 *
 * 一次失败不改变状态：上一次核实仍然成立，只是这次没读到。连续失败到 `maxFailures`
 * 才转 `unverified` 并离开榜单 —— 那是「我们不知道它现在还是不是公开的」，
 * 不能继续把它当已核实展示。
 */
export async function recordVerifyFailure(
  db: D1Like,
  fullName: string,
  at: string,
  maxFailures: number,
): Promise<void> {
  await db
    .prepare(
      "UPDATE collected_repo SET verify_failures = verify_failures + 1, " +
        "verify_state = CASE WHEN verify_state = 'verified' AND verify_failures + 1 >= ? " +
        "THEN 'unverified' ELSE verify_state END, last_seen_at = ? " +
        "WHERE full_name = ?",
    )
    .bind(maxFailures, at, fullName)
    .run();
}

/** 设置或清除隐藏。`null` 表示恢复展示。 */
export async function setHidden(
  db: D1Like,
  fullName: string,
  hiddenBy: HiddenBy | null,
  at: string,
): Promise<void> {
  await db
    .prepare("UPDATE collected_repo SET hidden_by = ?, last_seen_at = ? WHERE full_name = ?")
    .bind(hiddenBy, at, fullName)
    .run();
}

/** 最近一段时间里因为「主题被拿掉」而下架的仓库数。读不到返回 `null`。 */
export async function delistedNoTopicSince(
  db: D1Like | undefined,
  sinceIso: string,
): Promise<number | null> {
  if (!db) return null;
  try {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM collected_repo " +
          "WHERE delisted_reason = 'no-topic' AND delisted_at >= ?",
      )
      .bind(sinceIso)
      .first<{ n: number }>();
    return typeof row?.n === "number" ? row.n : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ collection_state */

const CURSOR_KEY = "cursor";

export async function loadCursor(db: D1Like | undefined): Promise<CollectionCursor | null> {
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT value FROM collection_state WHERE key = ?")
      .bind(CURSOR_KEY)
      .first<{ value: string }>();
    if (!row || typeof row.value !== "string") return null;
    return JSON.parse(row.value) as CollectionCursor;
  } catch {
    return null;
  }
}

export async function saveCursor(
  db: D1Like | undefined,
  cursor: CollectionCursor,
): Promise<void> {
  if (!db) return;
  try {
    await db
      .prepare(
        "INSERT INTO collection_state (key, value) VALUES (?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .bind(CURSOR_KEY, JSON.stringify(cursor))
      .run();
  } catch {
    /* 游标是旁路：存不下就下一轮从头开始，不会重复写入（upsert 是幂等的）。 */
  }
}
