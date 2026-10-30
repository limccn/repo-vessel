/**
 * 测试用的内存 D1（M3 的收藏层）。
 *
 * 与 `fakeD1.ts` 同一个思路，但覆盖四张表。它按**语句开头**分派 —— 每条 SQL
 * 都是 `db/*.ts` 里写死的那一句，没有用户输入参与拼接。`fail: true` 模拟
 * 「迁移还没应用」：读的人必须把它当成失败，而不是空结果。
 */

import type { D1Like } from "@/worker/env";
import type { CollectedRepoRow, RepoClaimRow, TakedownRow } from "@/worker/db/schema";

export interface FakeCollectionDb {
  db: D1Like;
  repos: Map<string, CollectedRepoRow>;
  claims: Map<string, RepoClaimRow>;
  takedowns: Map<string, TakedownRow>;
  state: Map<string, string>;
  /** `repo_cache` —— 榜单缓存与 M1 的信封缓存共用一张表。 */
  cache: Map<string, { payload: string; fetched_at: string }>;
  /** `metrics_daily` —— 键是 `${day}|${event}|${dim}`，值是累计计数。 */
  metrics: Map<string, number>;
  /** 执行过的语句，按顺序。断言「没有打上游」时用得上。 */
  queries: string[];
}

export interface FakeCollectionDbOptions {
  fail?: boolean;
  repos?: CollectedRepoRow[];
  claims?: RepoClaimRow[];
}

function normalize(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function sortByPushedAsc(a: CollectedRepoRow, b: CollectedRepoRow): number {
  return (a.pushed_at ?? "").localeCompare(b.pushed_at ?? "");
}

export function createFakeCollectionDb({
  fail = false,
  repos = [],
  claims = [],
}: FakeCollectionDbOptions = {}): FakeCollectionDb {
  const repoRows = new Map(repos.map((row) => [row.full_name, { ...row }]));
  const claimRows = new Map(claims.map((row) => [row.full_name, { ...row }]));
  const takedownRows = new Map<string, TakedownRow>();
  const stateRows = new Map<string, string>();
  const cacheRows = new Map<string, { payload: string; fetched_at: string }>();
  const metricRows = new Map<string, number>();
  const queries: string[] = [];

  function execute(rawQuery: string, values: unknown[]): Record<string, unknown>[] {
    const q = normalize(rawQuery);
    queries.push(q);
    if (fail) throw new Error("d1: no such table");

    /* ---------------------------------------------------------- collected_repo */

    if (q.startsWith("INSERT INTO collected_repo")) {
      const [
        fullName,
        owner,
        name,
        ownerType,
        isPrivate,
        isFork,
        archived,
        starCount,
        forkCount,
        pushedAt,
        createdAt,
        description,
        language,
        topicsJson,
        enrolledTopic,
        verifiedAt,
        firstSeenAt,
        lastSeenAt,
      ] = values as [
        string, string, string, string | null, number | null, number | null,
        number | null, number | null, number | null, string | null,
        string | null, string | null, string | null, string | null,
        string | null, string, string, string,
      ];

      const existing = repoRows.get(fullName);
      repoRows.set(fullName, {
        full_name: fullName,
        owner,
        name,
        owner_type: ownerType,
        is_private: isPrivate,
        is_fork: isFork,
        archived,
        star_count: starCount,
        fork_count: forkCount,
        pushed_at: pushedAt,
        created_at: createdAt,
        description,
        language,
        topics_json: topicsJson,
        enrolled_topic: enrolledTopic,
        verify_state: "verified",
        verify_failures: 0,
        verified_at: verifiedAt,
        first_seen_at: existing?.first_seen_at ?? firstSeenAt,
        last_seen_at: lastSeenAt,
        delisted_reason: null,
        delisted_at: null,
        /* 关键：重扫不复活已隐藏的仓库。 */
        hidden_by: existing?.hidden_by ?? null,
      });
      return [];
    }

    if (q.startsWith("SELECT * FROM collected_repo WHERE full_name = ?")) {
      const row = repoRows.get(String(values[0]));
      return row ? [{ ...row }] : [];
    }

    if (q.startsWith("SELECT * FROM collected_repo WHERE verify_state != 'delisted'")) {
      const limit = Number(values[0]);
      return [...repoRows.values()]
        .filter((row) => row.verify_state !== "delisted")
        .sort((a, b) => {
          const an = a.verified_at === null ? 0 : 1;
          const bn = b.verified_at === null ? 0 : 1;
          if (an !== bn) return an - bn;
          return (a.verified_at ?? "").localeCompare(b.verified_at ?? "");
        })
        .slice(0, limit)
        .map((row) => ({ ...row }));
    }

    if (q.startsWith("SELECT * FROM collected_repo WHERE verify_state = 'verified'")) {
      const cutoff = String(values[0]);
      const embers = q.includes("AND star_count IS NOT NULL");
      const forks = q.includes("AND is_fork = 1");
      const limit = Number(values[values.length - 1]);
      const stars = embers ? Number(values[1]) : 0;
      const rows = [...repoRows.values()].filter(
        (row) =>
          row.verify_state === "verified" &&
          row.hidden_by === null &&
          row.pushed_at !== null &&
          row.pushed_at <= cutoff &&
          (!embers || (row.star_count !== null && row.star_count >= stars)) &&
          (!forks || row.is_fork === 1),
      );
      rows.sort((a, b) => {
        if (embers && (a.star_count ?? 0) !== (b.star_count ?? 0)) {
          return (b.star_count ?? 0) - (a.star_count ?? 0);
        }
        return sortByPushedAsc(a, b);
      });
      return rows.slice(0, limit).map((row) => ({ ...row }));
    }

    if (q.startsWith("UPDATE collected_repo SET verify_state = 'delisted'")) {
      const [reason, at, , fullName] = values as [string, string, string, string];
      const row = repoRows.get(fullName);
      if (row) {
        row.verify_state = "delisted";
        row.delisted_reason = reason as CollectedRepoRow["delisted_reason"];
        row.delisted_at = at;
        row.last_seen_at = at;
      }
      return [];
    }

    if (q.startsWith("UPDATE collected_repo SET verify_failures")) {
      const [maxFailures, at, fullName] = values as [number, string, string];
      const row = repoRows.get(fullName);
      if (row) {
        row.verify_failures += 1;
        if (row.verify_state === "verified" && row.verify_failures >= maxFailures) {
          row.verify_state = "unverified";
        }
        row.last_seen_at = at;
      }
      return [];
    }

    if (q.startsWith("UPDATE collected_repo SET hidden_by")) {
      const [hiddenBy, , fullName] = values as [string | null, string, string];
      const row = repoRows.get(fullName);
      if (row) row.hidden_by = hiddenBy as CollectedRepoRow["hidden_by"];
      return [];
    }

    if (q.startsWith("SELECT COUNT(*) AS n FROM collected_repo")) {
      const since = String(values[0]);
      const n = [...repoRows.values()].filter(
        (row) => row.delisted_reason === "no-topic" && (row.delisted_at ?? "") >= since,
      ).length;
      return [{ n }];
    }

    /* ------------------------------------------------------- collection_state */

    if (q.startsWith("SELECT value FROM collection_state")) {
      const value = stateRows.get(String(values[0]));
      return value === undefined ? [] : [{ value }];
    }

    if (q.startsWith("INSERT INTO collection_state")) {
      stateRows.set(String(values[0]), String(values[1]));
      return [];
    }

    /* ------------------------------------------------------------- repo_claim */

    if (q.startsWith("SELECT * FROM repo_claim WHERE full_name = ?")) {
      const row = claimRows.get(String(values[0]));
      return row ? [{ ...row }] : [];
    }

    if (q.startsWith("INSERT INTO repo_claim")) {
      const [fullName, login, claimedAt, updatedAt] = values as [string, string, string, string];
      const existing = claimRows.get(fullName);
      claimRows.set(fullName, {
        full_name: fullName,
        login,
        claimed_at: existing?.claimed_at ?? claimedAt,
        updated_at: updatedAt,
      });
      return [];
    }

    if (q.startsWith("DELETE FROM repo_claim")) {
      claimRows.delete(String(values[0]));
      return [];
    }

    if (q.startsWith("SELECT c.full_name AS full_name")) {
      const login = String(values[0]);
      return [...claimRows.values()]
        .filter((claim) => claim.login === login)
        .sort((a, b) => b.claimed_at.localeCompare(a.claimed_at))
        .map((claim) => {
          const repo = repoRows.get(claim.full_name);
          return {
            full_name: claim.full_name,
            claimed_at: claim.claimed_at,
            verify_state: repo?.verify_state ?? null,
            hidden_by: repo?.hidden_by ?? null,
            verified_at: repo?.verified_at ?? null,
          };
        });
    }

    if (q.startsWith("SELECT * FROM repo_claim WHERE login = ?")) {
      return [...claimRows.values()]
        .filter((row) => row.login === String(values[0]))
        .sort((a, b) => b.claimed_at.localeCompare(a.claimed_at))
        .map((row) => ({ ...row }));
    }

    /* -------------------------------------------------------- takedown_request */

    if (q.startsWith("INSERT INTO takedown_request")) {
      const [ticket, fullName, reason, ipHash, createdAt, updatedAt] = values as [
        string, string, string | null, string | null, string, string,
      ];
      takedownRows.set(ticket, {
        ticket,
        full_name: fullName,
        reason,
        status: "received",
        ip_hash: ipHash,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return [];
    }

    if (q.startsWith("SELECT ticket, full_name")) {
      const row = takedownRows.get(String(values[0]));
      return row ? [{ ...row }] : [];
    }

    if (q.startsWith("SELECT COUNT(*) AS n FROM takedown_request")) {
      const [ipHash, since] = values as [string, string];
      const n = [...takedownRows.values()].filter(
        (row) => row.ip_hash === ipHash && row.created_at >= since,
      ).length;
      return [{ n }];
    }

    /* ------------------------------------------------------------- metrics_daily */

    if (q.startsWith("INSERT INTO metrics_daily")) {
      const [day, event, dim, amount] = values as [string, string, string, number];
      const key = `${day}|${event}|${dim}`;
      metricRows.set(key, (metricRows.get(key) ?? 0) + Number(amount));
      return [];
    }

    /* -------------------------------------------------------------- repo_cache */

    if (q.startsWith("SELECT payload, fetched_at FROM repo_cache")) {
      const row = cacheRows.get(String(values[0]));
      return row ? [{ ...row }] : [];
    }

    if (q.startsWith("INSERT INTO repo_cache")) {
      const [key, payload, fetchedAt] = values as [string, string, string];
      cacheRows.set(key, { payload, fetched_at: fetchedAt });
      return [];
    }

    if (q.startsWith("DELETE FROM repo_cache WHERE fetched_at <")) {
      const cutoff = String(values[0]);
      for (const [key, row] of cacheRows) {
        if (row.fetched_at < cutoff) cacheRows.delete(key);
      }
      return [];
    }

    if (q.startsWith("DELETE FROM repo_cache")) {
      cacheRows.delete(String(values[0]));
      return [];
    }

    throw new Error(`fake D1: unhandled query ${q}`);
  }

  const db = {
    prepare(rawQuery: string) {
      let values: unknown[] = [];
      const statement = {
        bind(...next: unknown[]) {
          values = next;
          return statement;
        },
        async first() {
          return execute(rawQuery, values)[0] ?? null;
        },
        async run() {
          execute(rawQuery, values);
          return { success: true };
        },
        async all() {
          return { results: execute(rawQuery, values) };
        },
      };
      return statement;
    },
  };

  return {
    db: db as unknown as D1Like,
    repos: repoRows,
    claims: claimRows,
    takedowns: takedownRows,
    state: stateRows,
    cache: cacheRows,
    metrics: metricRows,
    queries,
  };
}
