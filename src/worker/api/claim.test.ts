// @vitest-environment node

import { describe, expect, it } from "vitest";
import { handleClaim } from "@/worker/api/claim";
import type { ApiError, ClaimPayload, Envelope } from "@/shared/contract";
import { createSessionPayload, signSession } from "@/worker/auth/session";
import { boardCacheKey } from "@/worker/cache/ttl";
import type { CollectedRepoRow } from "@/worker/db/schema";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const SECRET = "test-session-secret";
const TOPICS = ["repo-vessel", "urn-of-repos"];

function row(overrides: Partial<CollectedRepoRow> = {}): CollectedRepoRow {
  return {
    full_name: "limccn/vessel",
    owner: "limccn",
    name: "vessel",
    owner_type: "User",
    is_private: 0,
    is_fork: 0,
    archived: 0,
    star_count: 3,
    fork_count: 0,
    pushed_at: "2024-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    description: null,
    language: "TypeScript",
    topics_json: '["repo-vessel"]',
    enrolled_topic: "repo-vessel",
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

async function signedRequest(
  method: string,
  login: string | null,
  body?: unknown,
): Promise<Request> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (login !== null) {
    const token = await signSession(createSessionPayload({ id: 1, login }), SECRET);
    headers.cookie = `rv_session=${token}`;
  }
  return new Request("https://repovessel.lmlh.net/api/claim/limccn/vessel", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type ClaimEnvelope = Envelope<ClaimPayload> & { error?: ApiError };

async function read(response: Response): Promise<ClaimEnvelope> {
  return (await response.json()) as ClaimEnvelope;
}

describe("GET /api/claim/:owner/:repo", () => {
  it("未登录 → 401", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    const response = await handleClaim(await signedRequest("GET", null), { DB: fake.db, SESSION_SECRET: SECRET }, {
      owner: "limccn",
      name: "vessel",
      topics: TOPICS,
    });

    expect(response.status).toBe(401);
    expect((await read(response)).error?.code).toBe("auth_failed");
  });

  it("别人的仓库返回「未认领」，不是 403", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    const response = await handleClaim(
      await signedRequest("GET", "someone-else"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect(response.status).toBe(200);
    expect((await read(response)).data).toMatchObject({
      claimed: false,
      manageable: false,
      claimedAt: null,
    });
  });
});

describe("POST /api/claim/:owner/:repo", () => {
  it("所有者认领一个已收录的仓库", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    const response = await handleClaim(
      await signedRequest("POST", "Limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect(response.status).toBe(200);
    expect((await read(response)).data).toMatchObject({ claimed: true, manageable: true });
    expect(fake.claims.get("limccn/vessel")?.login).toBe("limccn");
  });

  it("不是所有者 → not_owner", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    const response = await handleClaim(
      await signedRequest("POST", "someone-else"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect(response.status).toBe(403);
    expect((await read(response)).error).toMatchObject({
      code: "claim_rejected",
      reason: "not_owner",
    });
  });

  it("没有收录 → not_enrolled", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleClaim(
      await signedRequest("POST", "limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect((await read(response)).error?.reason).toBe("not_enrolled");
  });

  it("组织仓库 → is_org", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ owner_type: "Organization" })] });

    const response = await handleClaim(
      await signedRequest("POST", "limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect((await read(response)).error?.reason).toBe("is_org");
  });

  it("私有仓库 → not_public", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ is_private: 1 })] });

    const response = await handleClaim(
      await signedRequest("POST", "limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect((await read(response)).error?.reason).toBe("not_public");
  });

  it("已下架的行认领不了", async () => {
    const fake = createFakeCollectionDb({
      repos: [row({ verify_state: "delisted", delisted_reason: "no-topic" })],
    });

    const response = await handleClaim(
      await signedRequest("POST", "limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect((await read(response)).error?.reason).toBe("not_enrolled");
  });
});

describe("PATCH /api/claim/:owner/:repo", () => {
  async function claimedEnv() {
    const fake = createFakeCollectionDb({
      repos: [row()],
      claims: [
        {
          full_name: "limccn/vessel",
          login: "limccn",
          claimed_at: "2026-10-01T00:00:00.000Z",
          updated_at: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
    return fake;
  }

  it("认领者可以隐藏，并立刻清掉榜单缓存", async () => {
    const fake = await claimedEnv();
    fake.cache.set(boardCacheKey("longest-sleep", "en"), {
      payload: "{}",
      fetched_at: new Date().toISOString(),
    });

    const response = await handleClaim(
      await signedRequest("PATCH", "limccn", { hidden: true }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect((await read(response)).data?.hidden).toBe(true);
    expect(fake.repos.get("limccn/vessel")?.hidden_by).toBe("owner");
    expect(fake.cache.has(boardCacheKey("longest-sleep", "en"))).toBe(false);
  });

  it("恢复展示", async () => {
    const fake = await claimedEnv();
    const hiddenRow = fake.repos.get("limccn/vessel");
    if (hiddenRow) hiddenRow.hidden_by = "owner";

    const response = await handleClaim(
      await signedRequest("PATCH", "limccn", { hidden: false }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect((await read(response)).data?.hidden).toBe(false);
    expect(fake.repos.get("limccn/vessel")?.hidden_by).toBeNull();
  });

  it("已经不符合收录条件时恢复不了", async () => {
    const fake = await claimedEnv();
    const target = fake.repos.get("limccn/vessel");
    if (target) {
      target.hidden_by = "owner";
      target.verify_state = "delisted";
      target.delisted_reason = "no-topic";
    }

    const response = await handleClaim(
      await signedRequest("PATCH", "limccn", { hidden: false }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect(response.status).toBe(403);
    expect((await read(response)).error?.reason).toBe("not_enrolled");
  });

  it("没认领的人改不了", async () => {
    const fake = await claimedEnv();

    const response = await handleClaim(
      await signedRequest("PATCH", "someone-else", { hidden: true }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect(response.status).toBe(403);
  });

  it("请求体里没有 hidden → 400", async () => {
    const fake = await claimedEnv();

    const response = await handleClaim(
      await signedRequest("PATCH", "limccn", { hidden: "yes" }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
    );

    expect(response.status).toBe(400);
    expect((await read(response)).error?.code).toBe("invalid_payload");
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

  it("认领成功记 claim:ok", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });
    const { ctx, settle } = ctxRecorder();

    const response = await handleClaim(
      await signedRequest("POST", "limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
      ctx,
    );
    await settle();

    expect(response.status).toBe(200);
    expect(dims(fake)).toEqual(["claim:ok"]);
  });

  it("不是所有者记 claim:not_owner", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });
    const { ctx, settle } = ctxRecorder();

    await handleClaim(
      await signedRequest("POST", "someone-else"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
      ctx,
    );
    await settle();

    expect(dims(fake)).toEqual(["claim:not_owner"]);
  });

  it("隐藏记 hide:ok，恢复被拒记 restore:not_enrolled", async () => {
    const fake = createFakeCollectionDb({
      repos: [row()],
      claims: [
        {
          full_name: "limccn/vessel",
          login: "limccn",
          claimed_at: "2026-10-01T00:00:00.000Z",
          updated_at: "2026-10-01T00:00:00.000Z",
        },
      ],
    });
    const { ctx, settle } = ctxRecorder();

    await handleClaim(
      await signedRequest("PATCH", "limccn", { hidden: true }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
      ctx,
    );

    /* 隐藏之后把它变成「已下架」：恢复必须被拒绝，且拒绝本身也是一次结果。 */
    const target = fake.repos.get("limccn/vessel");
    if (target) {
      target.verify_state = "delisted";
      target.delisted_reason = "no-topic";
    }

    await handleClaim(
      await signedRequest("PATCH", "limccn", { hidden: false }),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
      ctx,
    );
    await settle();

    expect(dims(fake)).toEqual(["hide:ok", "restore:not_enrolled"]);
  });

  it("GET 不记 —— 读状态不是一次操作", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });
    const { ctx, settle } = ctxRecorder();

    await handleClaim(
      await signedRequest("GET", "limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      { owner: "limccn", name: "vessel", topics: TOPICS },
      ctx,
    );
    await settle();

    expect(fake.metrics.size).toBe(0);
  });
});
