/**
 * D1 缓存读写。
 *
 * 缓存是**优化**，不是事实来源。这里所有失败都降级成「未命中」：表没建、
 * D1 没绑、SQL 报错 —— 一律当作没有缓存，绝不让缓存的问题变成一个 500。
 *
 * 只存 `complete` / `partial` 的信封。把 `failed` 存下来等于把一次故障
 * 延长成一个 TTL。
 */

import type { Envelope } from "@/shared/contract";
import type { D1Like } from "@/worker/env";

export interface CacheEntry {
  /** 序列化后的 `Envelope`，调用方自己解析。 */
  payload: string;
  /** 抓取时刻（ISO-8601）。响应里的 `readAt` 就是它。 */
  fetchedAt: string;
}

export async function cacheGet(db: D1Like | undefined, key: string): Promise<CacheEntry | null> {
  if (!db) return null;
  try {
    const row = await db
      .prepare("SELECT payload, fetched_at FROM repo_cache WHERE cache_key = ?")
      .bind(key)
      .first<{ payload: string; fetched_at: string }>();
    if (!row || typeof row.payload !== "string" || typeof row.fetched_at !== "string") {
      return null;
    }
    return { payload: row.payload, fetchedAt: row.fetched_at };
  } catch {
    return null;
  }
}

/** 删掉比 `olderThanIso` 更旧的缓存行。不删也没错，只是表会一直长。 */
export async function pruneCache(
  db: D1Like | undefined,
  olderThanIso: string,
): Promise<void> {
  if (!db) return;
  try {
    await db.prepare("DELETE FROM repo_cache WHERE fetched_at < ?").bind(olderThanIso).run();
  } catch {
    /* 清理失败不影响任何响应。 */
  }
}

export async function cacheSet(
  db: D1Like | undefined,
  key: string,
  envelope: Envelope<unknown>,
  fetchedAt: string,
): Promise<void> {
  if (!db) return;
  if (envelope.completeness === "failed") return;
  try {
    await db
      .prepare(
        "INSERT INTO repo_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?) " +
          "ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at",
      )
      .bind(key, JSON.stringify(envelope), fetchedAt)
      .run();
  } catch {
    /* 写缓存失败不影响响应 —— 缓存是旁路。 */
  }
}
