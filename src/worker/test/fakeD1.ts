/**
 * 测试用的内存 D1。
 *
 * 只实现缓存层真正用到的那几句 SQL（一条 `SELECT … WHERE cache_key = ?` 与一条
 * `INSERT … ON CONFLICT`）。`fail: true` 模拟「表还没建」—— 缓存层必须把它
 * 当成未命中，而不是 500。
 */

import type { D1Like } from "@/worker/env";

export interface FakeDb {
  db: D1Like;
  rows: Map<string, { payload: string; fetched_at: string }>;
}

export interface FakeDbOptions {
  /** 让每次查询与写入都抛错，模拟 D1 未绑定表或 SQL 出错。 */
  fail?: boolean;
  /** 预置的行。键是 `cache_key`。 */
  seed?: Record<string, { payload: string; fetchedAt: string }>;
}

export function createFakeDb({ fail = false, seed = {} }: FakeDbOptions = {}): FakeDb {
  const rows = new Map<string, { payload: string; fetched_at: string }>();
  for (const [key, value] of Object.entries(seed)) {
    rows.set(key, { payload: value.payload, fetched_at: value.fetchedAt });
  }

  const db = {
    prepare(query: string) {
      const values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) {
          values.splice(0, values.length, ...next);
          return statement;
        },
        async first() {
          if (fail) throw new Error("d1: no such table: repo_cache");
          if (!query.startsWith("SELECT")) throw new Error(`d1: unexpected query ${query}`);
          return rows.get(String(values[0])) ?? null;
        },
        async run() {
          if (fail) throw new Error("d1: no such table: repo_cache");
          if (!query.startsWith("INSERT")) throw new Error(`d1: unexpected query ${query}`);
          const [key, payload, fetchedAt] = values as [string, string, string];
          rows.set(key, { payload, fetched_at: fetchedAt });
          return { success: true };
        },
        async all() {
          if (fail) throw new Error("d1: no such table: repo_cache");
          return { results: [...rows.values()] };
        },
      };
      return statement;
    },
  };

  return { db: db as unknown as D1Like, rows };
}
