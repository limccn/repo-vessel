/**
 * `takedown_request` 的读写。
 *
 * 三个决定：
 *   - **提交不自动隐藏。** 匿名提交无法区分所有者与路人；立即生效等于给任何人
 *     一个「让任意仓库从榜单消失」的按钮。处理由维护者执行（见 `docs/runbook.md`）。
 *   - **只存 HMAC 过的 IP。** 限流需要「同一个来源」这个事实，不需要「谁」。
 *   - **工单号读不到时说 404。** 不确认某张工单是否存在。
 */

import type { D1Like } from "@/worker/env";
import type { TakedownRow } from "./schema";

export interface NewTakedown {
  ticket: string;
  fullName: string;
  reason: string | null;
  ipHash: string | null;
  at: string;
}

export async function insertTakedown(db: D1Like, entry: NewTakedown): Promise<void> {
  await db
    .prepare(
      "INSERT INTO takedown_request " +
        "(ticket, full_name, reason, status, ip_hash, created_at, updated_at) " +
        "VALUES (?, ?, ?, 'received', ?, ?, ?)",
    )
    .bind(entry.ticket, entry.fullName, entry.reason, entry.ipHash, entry.at, entry.at)
    .run();
}

export async function readTakedown(
  db: D1Like,
  ticket: string,
): Promise<TakedownRow | null> {
  return db
    .prepare(
      "SELECT ticket, full_name, reason, status, ip_hash, created_at, updated_at " +
        "FROM takedown_request WHERE ticket = ?",
    )
    .bind(ticket)
    .first<TakedownRow>();
}

/** 同一来源在窗口内的提交次数。读不到返回 `0` —— 限流读不到时放行，不是无限拒绝。 */
export async function countRecentTakedowns(
  db: D1Like | undefined,
  ipHash: string,
  sinceIso: string,
): Promise<number> {
  if (!db) return 0;
  try {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM takedown_request WHERE ip_hash = ? AND created_at >= ?",
      )
      .bind(ipHash, sinceIso)
      .first<{ n: number }>();
    return typeof row?.n === "number" ? row.n : 0;
  } catch {
    return 0;
  }
}
