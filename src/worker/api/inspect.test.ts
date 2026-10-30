// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import type { InspectPayload } from "@/shared/contract";
import { handleInspect } from "@/worker/api/inspect";
import { userCacheKey } from "@/worker/cache/ttl";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { createFakeDb } from "@/worker/test/fakeD1";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const TOPICS = ["repo-vessel", "urn-of-repos"];
/** 断言里的句子都是简体中文原文 —— 显式传它，别依赖默认语言。 */
const ZH = "zh-Hans" as const;
const ENV: Env = { GITHUB_API_TOKEN: "test-token" };
const USER = { login: "limccn", type: "User", avatar_url: "https://avatars.example/limccn" };

interface Body {
  data: InspectPayload | null;
  completeness: "complete" | "partial" | "failed";
  missingPages: number[];
  readAt: string | null;
  error?: { code: string; message: string; retryAfter?: number; reason?: string };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function repo(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    full_name: `limccn/${name}`,
    owner: { login: "limccn", type: "User" },
    description: null,
    language: "TypeScript",
    stargazers_count: 0,
    forks_count: 0,
    pushed_at: "2023-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    fork: false,
    archived: false,
    private: false,
    topics: ["repo-vessel"],
    ...extra,
  };
}

function mockGitHub(handler: (url: URL) => Response) {
  const mock = vi.fn(async (input: RequestInfo | URL) => handler(new URL(String(input))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

async function readBody(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/inspect/:username", () => {
  it("完整读取：给出账户、仓库与收录数，并带上主题回显", async () => {
    mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") {
        return json([repo("vessel"), repo("ashes", { topics: ["other"] })]);
      }
      return json({ message: "Not Found" }, 404);
    });

    const response = await handleInspect(ENV, undefined, "limccn", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-repo-topics")).toBe("repo-vessel,urn-of-repos");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.completeness).toBe("complete");
    expect(body.missingPages).toEqual([]);
    expect(body.readAt).not.toBeNull();
    expect(body.data?.account.login).toBe("limccn");
    expect(body.data?.repoCount).toBe(2);
    expect(body.data?.enrolledCount).toBe(1);
    expect(body.data?.repos).toHaveLength(2);
    expect(body.data?.reposTruncated).toBe(false);
  });

  it("用户名形态不对时直接 400，不发任何请求", async () => {
    const mock = mockGitHub(() => json({}));

    const response = await handleInspect(ENV, undefined, "bad--name", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(400);
    expect(body.completeness).toBe("failed");
    expect(body.data).toBeNull();
    expect(body.readAt).toBeNull();
    expect(body.error?.code).toBe("invalid_username");
    expect(mock).not.toHaveBeenCalled();
  });

  it("账户不存在时是 account_not_found", async () => {
    mockGitHub(() => json({ message: "Not Found" }, 404));

    const response = await handleInspect(ENV, undefined, "nobody", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("account_not_found");
  });

  it("组织账户被拒绝，且不去读它的仓库", async () => {
    const mock = mockGitHub(() =>
      json({ login: "cloudflare", type: "Organization", avatar_url: null }),
    );

    const response = await handleInspect(ENV, undefined, "cloudflare", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(422);
    expect(body.error).toMatchObject({ code: "account_is_organization", reason: "is_org" });
    expect(body.data).toBeNull();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("限流时是 429，并把重试时间原样带出", async () => {
    mockGitHub(() => json({ message: "slow down" }, 429, { "retry-after": "60" }));

    const response = await handleInspect(ENV, undefined, "limccn", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(429);
    expect(body.error).toMatchObject({ code: "rate_limited", retryAfter: 60 });
    expect(body.readAt).toBeNull();
  });

  it("缺令牌时是 upstream_unavailable，而不是空结果", async () => {
    const mock = mockGitHub(() => json({}));

    const response = await handleInspect({}, undefined, "limccn", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe("upstream_unavailable");
    expect(mock).not.toHaveBeenCalled();
  });

  it("缺页时 completeness 是 partial，计数是未知，但最长沉睡仍然可信", async () => {
    mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") {
        const page = Number(url.searchParams.get("page"));
        if (page === 1) {
          return json([repo("vessel"), repo("ashes")], 200, {
            link: '<https://api.github.com/users/limccn/repos?page=2>; rel="next"',
          });
        }
        if (page === 2) return json({ message: "boom" }, 500);
        return json([]);
      }
      return json({ message: "Not Found" }, 404);
    });

    const response = await handleInspect(ENV, undefined, "limccn", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body.completeness).toBe("partial");
    expect(body.missingPages).toEqual([2]);
    expect(body.data?.repos).toHaveLength(2);
    expect(body.data?.repoCount).toBeNull();
    expect(body.data?.enrolledCount).toBeNull();
    expect(body.data?.stats.longestDormantDays).not.toBeNull();
    expect(body.data?.stats.emberCount).toBeNull();
  });

  it("新鲜的缓存直接返回，不再请求上游", async () => {
    const cached: Body = {
      data: {
        account: { login: "limccn", type: "User", avatarUrl: null },
        repoCount: 7,
        enrolledCount: 2,
        stats: { longestDormantDays: 800, emberCount: 0, forkCount: 1, archivedCount: 0 },
        title: {
          id: "light-traveler",
          name: "轻装旅人",
          evidence: [{ text: "公开仓库 7 个，其中 Fork 1 个。" }],
        },
        representatives: { longestDormant: null, brightestEmber: null, travelledFork: null },
        repos: [],
        reposTruncated: false,
      },
      completeness: "complete",
      missingPages: [],
      readAt: new Date().toISOString(),
    };
    const { db, rows: dbRows } = createFakeDb({
      seed: {
        [userCacheKey("limccn", ZH)]: {
          payload: JSON.stringify(cached),
          fetchedAt: cached.readAt ?? "",
        },
      },
    });
    const mock = mockGitHub(() => json(USER));
    const waitUntil = vi.fn();

    const response = await handleInspect(
      { ...ENV, DB: db },
      { waitUntil } as ExecutionContextLike,
      "limccn",
      TOPICS,
      ZH,
    );
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body.data?.repoCount).toBe(7);
    // 返回的 readAt 是抓取时间，不是此刻 —— 「数据截至」才对得上。
    expect(body.readAt).toBe(cached.readAt);
    expect(mock).not.toHaveBeenCalled();
    // 后台只剩一次埋点写入；缓存行没有被重写，说明没有安排刷新。
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(dbRows.get(userCacheKey("limccn", ZH))?.fetched_at).toBe(cached.readAt);
  });

  it("过期的缓存先给旧数据，并在后台刷新", async () => {
    const stale: Body = {
      data: {
        account: { login: "limccn", type: "User", avatarUrl: null },
        repoCount: 1,
        enrolledCount: 1,
        stats: { longestDormantDays: 100, emberCount: 0, forkCount: 0, archivedCount: 0 },
        title: { id: "visitor", name: "初访者", evidence: [{ text: "公开仓库少于 3 个。" }] },
        representatives: { longestDormant: null, brightestEmber: null, travelledFork: null },
        repos: [],
        reposTruncated: false,
      },
      completeness: "complete",
      missingPages: [],
      readAt: "2024-01-01T00:00:00.000Z",
    };
    const { db, rows } = createFakeDb({
      seed: {
        [userCacheKey("limccn", ZH)]: {
          payload: JSON.stringify(stale),
          fetchedAt: stale.readAt ?? "",
        },
      },
    });
    const mock = mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") return json([repo("vessel")]);
      return json({ message: "Not Found" }, 404);
    });
    const pending: Promise<unknown>[] = [];

    const response = await handleInspect(
      { ...ENV, DB: db },
      { waitUntil: (promise) => void pending.push(promise) },
      "limccn",
      TOPICS,
      ZH,
    );
    const body = await readBody(response);

    // 旧数据原样返回 —— 旧不等于不完整，completeness 不被改写。
    expect(body.readAt).toBe(stale.readAt);
    expect(body.completeness).toBe("complete");
    expect(body.data?.repoCount).toBe(1);

    await Promise.all(pending);

    expect(mock).toHaveBeenCalledTimes(2);
    expect(rows.get(userCacheKey("limccn", ZH))?.fetched_at).not.toBe(stale.readAt);
  });

  it("缓存按语言分开：en 请求不会读到 zh-Hans 的缓存", async () => {
    const cached: Body = {
      data: {
        account: { login: "limccn", type: "User", avatarUrl: null },
        repoCount: 7,
        enrolledCount: 2,
        stats: { longestDormantDays: 800, emberCount: 0, forkCount: 1, archivedCount: 0 },
        title: {
          id: "light-traveler",
          name: "轻装旅人",
          evidence: [{ text: "公开仓库 7 个，其中 Fork 1 个。" }],
        },
        representatives: { longestDormant: null, brightestEmber: null, travelledFork: null },
        repos: [],
        reposTruncated: false,
      },
      completeness: "complete",
      missingPages: [],
      readAt: new Date().toISOString(),
    };
    const { db, rows } = createFakeDb({
      seed: {
        [userCacheKey("limccn", ZH)]: {
          payload: JSON.stringify(cached),
          fetchedAt: cached.readAt ?? "",
        },
      },
    });
    const mock = mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") return json([repo("vessel")]);
      return json({ message: "Not Found" }, 404);
    });

    const response = await handleInspect({ ...ENV, DB: db }, undefined, "limccn", TOPICS, "en");
    const body = await readBody(response);

    // 信封里的称号与证据是已翻译的句子，所以语言是数据的一部分：
    // en 请求必须重新读取，而不是拿到那份中文信封。
    expect(mock).toHaveBeenCalled();
    expect(body.data?.repoCount).toBe(1);
    // 简体那一份原样留着，en 自己写了一份。
    expect(rows.get(userCacheKey("limccn", ZH))?.fetched_at).toBe(cached.readAt);
    expect(rows.has(userCacheKey("limccn", "en"))).toBe(true);
  });

  it("称号与证据随请求语言变，数字仍然来自派生结果", async () => {
    mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") {
        return json([repo("vessel"), repo("ashes"), repo("keg")]);
      }
      return json({ message: "Not Found" }, 404);
    });

    const en = await readBody(await handleInspect(ENV, undefined, "limccn", TOPICS, "en"));
    const zh = await readBody(await handleInspect(ENV, undefined, "limccn", TOPICS, ZH));

    expect(en.data?.title.id).toBe("time-collector");
    expect(en.data?.title.name).toBe("Keeper of Hours");
    expect(en.data?.title.evidence[0]?.text).toBe(
      "Last pushed three years ago or earlier: 3.",
    );
    expect(zh.data?.title.name).toBe("时光收藏家");
    expect(zh.data?.title.evidence[0]?.text).toBe("有 3 个仓库最后一次推送在三年前或更早。");
  });

  it("坏掉的缓存当作未命中，继续实时读取", async () => {
    const { db } = createFakeDb({
      seed: {
        [userCacheKey("limccn", ZH)]: { payload: "{不是 JSON", fetchedAt: "2024-01-01T00:00:00.000Z" },
      },
    });
    mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") return json([repo("vessel")]);
      return json({ message: "Not Found" }, 404);
    });

    const response = await handleInspect({ ...ENV, DB: db }, undefined, "limccn", TOPICS, ZH);
    const body = await readBody(response);

    expect(response.status).toBe(200);
    expect(body.data?.repoCount).toBe(1);
  });
});

describe("测量埋点", () => {
  function ctxRecorder() {
    const pending: Promise<unknown>[] = [];
    return {
      ctx: { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) },
      settle: () => Promise.all(pending),
    };
  }

  function dims(fake: ReturnType<typeof createFakeCollectionDb>): string[] {
    return [...fake.metrics.keys()].map((key) => key.split("|")[2] ?? "");
  }

  it("成功读取记一次 inspect_read:complete", async () => {
    mockGitHub((url) => {
      if (url.pathname === "/users/limccn") return json(USER);
      if (url.pathname === "/users/limccn/repos") return json([repo("vessel")]);
      return json({ message: "Not Found" }, 404);
    });
    const fake = createFakeCollectionDb();
    const { ctx, settle } = ctxRecorder();

    const response = await handleInspect({ ...ENV, DB: fake.db }, ctx, "limccn", TOPICS, ZH);
    await settle();

    expect(response.status).toBe(200);
    expect(dims(fake)).toEqual(["complete"]);
  });

  it("读取失败记的是原因，不是零", async () => {
    mockGitHub(() => json({ message: "Not Found" }, 404));
    const fake = createFakeCollectionDb();
    const { ctx, settle } = ctxRecorder();

    const response = await handleInspect({ ...ENV, DB: fake.db }, ctx, "nobody", TOPICS, ZH);
    await settle();

    expect(response.status).toBe(404);
    expect(dims(fake)).toEqual(["failed:account_not_found"]);
  });

  it("用户名不合法也记一次，且一次上游请求都不发", async () => {
    const mock = mockGitHub(() => json({}));
    const fake = createFakeCollectionDb();
    const { ctx, settle } = ctxRecorder();

    const response = await handleInspect({ ...ENV, DB: fake.db }, ctx, "bad--name", TOPICS, ZH);
    await settle();

    expect(response.status).toBe(400);
    expect(mock).not.toHaveBeenCalled();
    expect(dims(fake)).toEqual(["failed:invalid_username"]);
  });
});
