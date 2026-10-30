/**
 * D1 行类型 —— 与 `migrations/0002_collection.sql` 一一对应。
 *
 * SQLite 没有布尔：`is_fork` / `is_private` / `archived` 都是 `INTEGER`，读出来是
 * `0 | 1 | null`。**`null` 不是 `0`** —— 它表示这一列从来没有被读到的值填过
 * （历史行、半途中断的写入）。转换统一走 `toBool()`，不要在各处写 `!== 0`。
 *
 * 时间一律 ISO-8601 UTC 字符串，与 `Envelope.readAt` 同一种写法。
 */

export type VerifyState = "pending" | "verified" | "unverified" | "delisted";

export type DelistReason = "private" | "org" | "no-topic" | "hidden";

export type HiddenBy = "owner" | "takedown";

export interface CollectedRepoRow {
  full_name: string;
  owner: string;
  name: string;
  owner_type: string | null;
  is_private: number | null;
  is_fork: number | null;
  archived: number | null;
  star_count: number | null;
  fork_count: number | null;
  pushed_at: string | null;
  created_at: string | null;
  description: string | null;
  language: string | null;
  topics_json: string | null;
  enrolled_topic: string | null;
  verify_state: VerifyState;
  verify_failures: number;
  verified_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  delisted_reason: DelistReason | null;
  delisted_at: string | null;
  hidden_by: HiddenBy | null;
}

export interface RepoClaimRow {
  full_name: string;
  login: string;
  claimed_at: string;
  updated_at: string;
}

import type { TakedownStatus } from "@/shared/contract";

export type { TakedownStatus };

export interface TakedownRow {
  ticket: string;
  full_name: string;
  reason: string | null;
  status: TakedownStatus;
  ip_hash: string | null;
  created_at: string;
  updated_at: string;
}

/** `collection_state` 里的那一条游标。见 `src/worker/collect/budget.ts`。 */
export interface CollectionCursor {
  /** 当前正在翻的主题下标（`topics[topicIndex]`）。 */
  topicIndex: number;
  /** 下一次要读的搜索结果页，从 1 开始。 */
  page: number;
  /** 已经完成的轮数。只在游标绕回第一个主题时加一。 */
  cycle: number;
  /** 本轮开始的时刻。 */
  startedAt: string;
  /** 上一次运行结束的时刻。 */
  lastRunAt: string;
  /** 上一次运行的一行人话摘要 —— 排查用，不展示。 */
  lastSummary: string;
}

/** SQLite 的 `0 | 1 | null` → 三态布尔。 */
export function toBool(value: number | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  return value !== 0;
}

/** 三态布尔 → SQLite 的 `0 | 1 | null`。 */
export function fromBool(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value ? 1 : 0;
}

/** `repo:Owner/Name` → `owner/name`（小写）。返回 `null` 表示形态不对。 */
export function normalizeFullName(raw: string): string | null {
  const trimmed = raw.trim();
  const parts = trimmed.split("/");
  if (parts.length !== 2) return null;
  const owner = parts[0]?.trim().toLowerCase() ?? "";
  const name = parts[1]?.trim().toLowerCase() ?? "";
  if (owner.length === 0 || name.length === 0) return null;
  // GitHub 用户名与仓库名的字符集。形态不对就不该进 SQL，更不该进上游。
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(owner)) return null;
  if (!/^[\w.-]{1,100}$/.test(name)) return null;
  return `${owner}/${name}`;
}
