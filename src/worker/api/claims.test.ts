// @vitest-environment node

import { describe, expect, it } from "vitest";
import { handleMyClaims } from "@/worker/api/claims";
import type { ApiError, ClaimsPayload, Envelope } from "@/shared/contract";
import { createSessionPayload, signSession } from "@/worker/auth/session";
import type { CollectedRepoRow, RepoClaimRow } from "@/worker/db/schema";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const SECRET = "test-session-secret";
const TOPICS = ["repo-vessel", "urn-of-repos"];

function repo(fullName: string, overrides: Partial<CollectedRepoRow> = {}): CollectedRepoRow {
  const [owner, name] = fullName.split("/") as [string, string];
  return {
    full_name: fullName,
    owner,
    name,
    owner_type: "User",
    is_private: 0,
    is_fork: 0,
    archived: 0,
    star_count: 1,
    fork_count: 0,
    pushed_at: "2024-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    description: null,
    language: null,
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

function claim(fullName: string): RepoClaimRow {
  return {
    full_name: fullName,
    login: "limccn",
    claimed_at: "2026-10-02T00:00:00.000Z",
    updated_at: "2026-10-02T00:00:00.000Z",
  };
}

async function request(login: string | null): Promise<Request> {
  const headers: Record<string, string> = {};
  if (login !== null) {
    headers.cookie = `rv_session=${await signSession(createSessionPayload({ id: 1, login }), SECRET)}`;
  }
  return new Request("https://repovessel.lmlh.net/api/claims", { headers });
}

type ClaimsEnvelope = Envelope<ClaimsPayload> & { error?: ApiError };

async function read(response: Response): Promise<ClaimsEnvelope> {
  return (await response.json()) as ClaimsEnvelope;
}

describe("GET /api/claims", () => {
  it("未登录 → 401", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleMyClaims(await request(null), { DB: fake.db, SESSION_SECRET: SECRET }, TOPICS);

    expect(response.status).toBe(401);
    expect((await read(response)).error?.code).toBe("auth_failed");
  });

  it("只列出自己的认领", async () => {
    const fake = createFakeCollectionDb({
      repos: [repo("limccn/vessel"), repo("someone/other")],
      claims: [claim("limccn/vessel"), { ...claim("someone/other"), login: "someone" }],
    });

    const response = await handleMyClaims(
      await request("Limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      TOPICS,
    );

    const claims = (await read(response)).data?.claims ?? [];
    expect(claims).toHaveLength(1);
    expect(claims[0]?.fullName).toBe("limccn/vessel");
  });

  it("隐藏过的仍然是已收录，仍然可以恢复", async () => {
    const fake = createFakeCollectionDb({
      repos: [repo("limccn/vessel", { hidden_by: "owner" })],
      claims: [claim("limccn/vessel")],
    });

    const response = await handleMyClaims(
      await request("limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      TOPICS,
    );

    expect((await read(response)).data?.claims[0]).toMatchObject({
      hidden: true,
      manageable: true,
      verifiedAt: "2026-10-01T00:00:00.000Z",
    });
  });

  it("仓库已经下架时，认领还在但不可操作", async () => {
    const fake = createFakeCollectionDb({
      repos: [repo("limccn/vessel", { verify_state: "delisted", delisted_reason: "no-topic" })],
      claims: [claim("limccn/vessel")],
    });

    const response = await handleMyClaims(
      await request("limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      TOPICS,
    );

    expect((await read(response)).data?.claims[0]).toMatchObject({
      manageable: false,
      hidden: false,
    });
  });

  it("没有认领 → 空列表，不是错误", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleMyClaims(
      await request("limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      TOPICS,
    );

    expect(response.status).toBe(200);
    expect((await read(response)).data?.claims).toEqual([]);
  });

  it("D1 读不到 → failed，不是空列表", async () => {
    const fake = createFakeCollectionDb({ fail: true });

    const response = await handleMyClaims(
      await request("limccn"),
      { DB: fake.db, SESSION_SECRET: SECRET },
      TOPICS,
    );

    expect(response.status).toBe(503);
    expect((await read(response)).error?.code).toBe("upstream_unavailable");
  });
});
