// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleCollectionStatus,
  resetCollectionStatusQuota,
} from "@/worker/api/collection-status";
import type { ApiError, CollectionStatusPayload, Envelope } from "@/shared/contract";
import type { CollectedRepoRow } from "@/worker/db/schema";
import type { GitHubRepo } from "@/worker/github/users";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const TOPICS = ["repo-vessel", "urn-of-repos"];
const ENV = { GITHUB_API_TOKEN: "test-token" };

function request(repo = "limccn/vessel", ip = "203.0.113.7"): Request {
  return new Request(
    `https://repovessel.lmlh.net/api/collection-status?repo=${encodeURIComponent(repo)}`,
    { headers: { "cf-connecting-ip": ip } },
  );
}

function repoItem(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "vessel",
    full_name: "limccn/vessel",
    owner: { login: "limccn", type: "User" },
    private: false,
    fork: false,
    archived: false,
    stargazers_count: 3,
    forks_count: 0,
    pushed_at: "2024-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    description: null,
    language: "TypeScript",
    topics: ["repo-vessel"],
    ...overrides,
  };
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

function stubFetch(handler: () => Response) {
  const mock = vi.fn(async () => handler());
  vi.stubGlobal("fetch", mock);
  return mock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type StatusEnvelope = Envelope<CollectionStatusPayload> & { error?: ApiError };

async function read(response: Response): Promise<StatusEnvelope> {
  return (await response.json()) as StatusEnvelope;
}

beforeEach(() => {
  resetCollectionStatusQuota();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/collection-status", () => {
  it("已收录的仓库由 D1 直接回答，不打上游", async () => {
    const mock = stubFetch(() => json({}));
    const fake = createFakeCollectionDb({ repos: [row()] });

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("collected");
    expect(envelope.data?.matchedTopic).toBe("repo-vessel");
    expect(envelope.data?.verifiedAt).toBe("2026-10-01T00:00:00.000Z");
    expect(mock).not.toHaveBeenCalled();
  });

  it("被所有者隐藏的仓库仍然是「已收录」—— 状态问的是收录，不是上榜", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ hidden_by: "owner" })] });

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("collected");
  });

  it("自己还没能确认的行，不再在线假装确认一次", async () => {
    const mock = stubFetch(() => json({}));
    const fake = createFakeCollectionDb({
      repos: [row({ verify_state: "unverified", verify_failures: 3 })],
    });

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("unconfirmed");
    expect(mock).not.toHaveBeenCalled();
  });

  it("还没进 D1 但确实带主题 → pending", async () => {
    stubFetch(() => json(repoItem()));
    const fake = createFakeCollectionDb();

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("pending");
    expect(envelope.data?.matchedTopic).toBe("repo-vessel");
  });

  it("确实没有主题 → no-topic", async () => {
    stubFetch(() => json(repoItem({ topics: [] })));
    const fake = createFakeCollectionDb();

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("no-topic");
  });

  it("组织仓库 → not-eligible", async () => {
    stubFetch(() =>
      json(repoItem({ owner: { login: "some-org", type: "Organization" } })),
    );
    const fake = createFakeCollectionDb();

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("not-eligible");
  });

  it("上游读不到时是 unconfirmed，绝不退化成 no-topic", async () => {
    stubFetch(() => json({ message: "unavailable" }, 502));
    const fake = createFakeCollectionDb();

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.data?.state).toBe("unconfirmed");
  });

  it("readAt 与 verifiedAt 是两个时间", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    const envelope = await read(
      await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS),
    );

    expect(envelope.readAt).not.toBe(envelope.data?.verifiedAt);
  });

  it("仓库不存在 → 404", async () => {
    stubFetch(() => json({ message: "Not Found" }, 404));
    const fake = createFakeCollectionDb();

    const response = await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS);

    expect(response.status).toBe(404);
    expect((await read(response)).error?.code).toBe("repo_unavailable");
  });

  it("仓库名形态不对 → 400，且不发请求", async () => {
    const mock = stubFetch(() => json({}));

    const response = await handleCollectionStatus({}, request("not-a-repo"), TOPICS);

    expect(response.status).toBe(400);
    expect((await read(response)).error?.code).toBe("invalid_payload");
    expect(mock).not.toHaveBeenCalled();
  });

  it("同一个来源连点超过窗口上限 → 429", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    for (let i = 0; i < 20; i += 1) {
      const response = await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS);
      expect(response.status).toBe(200);
    }

    const limited = await handleCollectionStatus({ ...ENV, DB: fake.db }, request(), TOPICS);
    expect(limited.status).toBe(429);
    expect((await read(limited)).error?.code).toBe("rate_limited");
  });
});
