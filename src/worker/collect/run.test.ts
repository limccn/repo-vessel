// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { runCollection } from "@/worker/collect/run";
import { MAX_VERIFY_FAILURES } from "@/worker/collect/budget";
import { boardCacheKey } from "@/worker/cache/ttl";
import type { CollectedRepoRow } from "@/worker/db/schema";
import type { GitHubRepo } from "@/worker/github/users";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const TOPIC = "repo-vessel";
const ENV = { GITHUB_API_TOKEN: "test-token", REPO_TOPICS: TOPIC };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function repoItem(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "vessel",
    full_name: "limccn/vessel",
    owner: { login: "limccn", type: "User" },
    private: false,
    fork: false,
    archived: false,
    stargazers_count: 12,
    forks_count: 1,
    pushed_at: "2023-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    description: "一只灵龛",
    language: "TypeScript",
    topics: [TOPIC],
    ...overrides,
  };
}

function stubGitHub(handler: (url: URL) => Response | Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL) => handler(new URL(String(input))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** 搜索只返回给定的仓库，不分页。 */
function stubSearch(items: GitHubRepo[]) {
  return stubGitHub((url) => {
    if (url.pathname === "/search/repositories") {
      return json({ total_count: items.length, incomplete_results: false, items });
    }
    return json({ message: "Not Found" }, 404);
  });
}

function row(overrides: Partial<CollectedRepoRow> = {}): CollectedRepoRow {
  return {
    full_name: "limccn/vessel",
    owner: "limccn",
    name: "vessel",
    owner_type: "User",
    is_private: 0,
    is_fork: 0,
    archived: 0,
    star_count: 12,
    fork_count: 1,
    pushed_at: "2023-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    description: null,
    language: "TypeScript",
    topics_json: '["repo-vessel"]',
    enrolled_topic: TOPIC,
    verify_state: "verified",
    verify_failures: 0,
    verified_at: "2026-10-01T00:00:00.000Z",
    first_seen_at: "2026-01-01T00:00:00.000Z",
    last_seen_at: "2026-10-01T00:00:00.000Z",
    delisted_reason: null,
    delisted_at: null,
    hidden_by: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runCollection", () => {
  it("没有 DB 或没有令牌时什么都不做", async () => {
    const mock = stubSearch([repoItem()]);

    expect(await runCollection({ REPO_TOPICS: TOPIC })).toBeNull();
    const { db } = createFakeCollectionDb();
    expect(await runCollection({ DB: db, REPO_TOPICS: TOPIC })).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });

  it("把带主题的个人公开仓库收进来", async () => {
    stubSearch([repoItem()]);
    const fake = createFakeCollectionDb();

    const summary = await runCollection({ ...ENV, DB: fake.db });

    const stored = fake.repos.get("limccn/vessel");
    expect(stored?.verify_state).toBe("verified");
    expect(stored?.enrolled_topic).toBe(TOPIC);
    expect(stored?.star_count).toBe(12);
    expect(summary?.discovered).toBeGreaterThan(0);
  });

  it("私有仓库、组织仓库、没有主题的仓库都不入库", async () => {
    stubSearch([
      repoItem({ full_name: "a/private", name: "private", private: true }),
      repoItem({ full_name: "org/repo", name: "repo", owner: { login: "org", type: "Organization" } }),
      repoItem({ full_name: "b/plain", name: "plain", topics: [] }),
    ]);
    const fake = createFakeCollectionDb();

    await runCollection({ ...ENV, DB: fake.db });

    expect(fake.repos.size).toBe(0);
  });

  it("重扫不复活已隐藏的仓库", async () => {
    stubSearch([repoItem()]);
    const fake = createFakeCollectionDb({ repos: [row({ hidden_by: "owner" })] });

    await runCollection({ ...ENV, DB: fake.db });

    expect(fake.repos.get("limccn/vessel")?.hidden_by).toBe("owner");
  });

  it("复核失败累加到阈值后，仓库离开榜单并且榜单缓存被清掉", async () => {
    stubGitHub(() => json({ message: "unavailable" }, 502));
    const fake = createFakeCollectionDb({
      repos: [row({ verify_failures: MAX_VERIFY_FAILURES - 1 })],
    });
    fake.cache.set(boardCacheKey("longest-sleep", "en"), {
      payload: "{}",
      fetched_at: "2026-11-01T00:00:00.000Z",
    });

    await runCollection({ ...ENV, DB: fake.db });

    expect(fake.repos.get("limccn/vessel")?.verify_state).toBe("unverified");
    expect(fake.cache.has(boardCacheKey("longest-sleep", "en"))).toBe(false);
  });

  it("复核成功会刷新数字", async () => {
    stubGitHub((url) => {
      if (url.pathname === "/search/repositories") {
        return json({ total_count: 0, incomplete_results: false, items: [] });
      }
      return json(repoItem({ stargazers_count: 999 }));
    });
    const fake = createFakeCollectionDb({ repos: [row()] });

    await runCollection({ ...ENV, DB: fake.db });

    expect(fake.repos.get("limccn/vessel")?.star_count).toBe(999);
  });

  it("仓库读不到（404）就下架，而不是等六轮", async () => {
    stubGitHub((url) => {
      if (url.pathname === "/search/repositories") {
        return json({ total_count: 0, incomplete_results: false, items: [] });
      }
      return json({ message: "Not Found" }, 404);
    });
    const fake = createFakeCollectionDb({ repos: [row()] });

    await runCollection({ ...ENV, DB: fake.db });

    expect(fake.repos.get("limccn/vessel")?.verify_state).toBe("delisted");
    expect(fake.repos.get("limccn/vessel")?.delisted_reason).toBe("private");
  });

  it("搜索被限流时结束本轮，并保留游标", async () => {
    const mock = stubGitHub(() =>
      json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-reset": "1900000000" }),
    );
    const fake = createFakeCollectionDb();

    const summary = await runCollection({ ...ENV, DB: fake.db });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(summary?.searches).toBe(1);
    expect(fake.state.get("cursor")).toContain("lastSummary");
  });

  it("上游不支持主题字段时不入库 —— 读不到不等于没有主题", async () => {
    stubSearch([repoItem({ topics: undefined })]);
    const fake = createFakeCollectionDb();

    await runCollection({ ...ENV, DB: fake.db });

    expect(fake.repos.size).toBe(0);
  });

  it("五个增量都记进 metrics_daily，且与摘要一致", async () => {
    stubSearch([repoItem()]);
    const fake = createFakeCollectionDb();

    const summary = await runCollection({ ...ENV, DB: fake.db });

    const recorded = Object.fromEntries(
      [...fake.metrics.entries()].map(([key, value]) => [key.split("|")[2] ?? "", value]),
    );
    expect(recorded.searches).toBe(summary?.searches);
    expect(recorded.discovered).toBe(summary?.discovered);
    expect(recorded.verified_reads ?? 0).toBe(summary?.verifiedReads);
    /* 0 不写行：报告在 `searches` 出现时把缺席的维度读成 0，
       没有 `searches` 才是「这一轮没跑」。 */
    expect(summary?.delisted).toBe(0);
    expect(recorded.delisted).toBeUndefined();
    expect(summary?.unconfirmed).toBe(0);
    expect(recorded.unconfirmed).toBeUndefined();
  });
});
