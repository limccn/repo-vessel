// @vitest-environment node

import { describe, expect, it } from "vitest";
import { handleTakedownStatus, handleTakedownSubmit } from "@/worker/api/takedown";
import type { ApiError, Envelope, TakedownPayload, TakedownStatusPayload } from "@/shared/contract";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const TOPICS = ["repo-vessel", "urn-of-repos"];
const SECRET = "test-session-secret";

function submitRequest(body: unknown, ip = "203.0.113.7"): Request {
  return new Request("https://repovessel.lmlh.net/api/takedown", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

type SubmitEnvelope = Envelope<TakedownPayload> & { error?: ApiError };
type StatusEnvelope = Envelope<TakedownStatusPayload> & { error?: ApiError };

async function readSubmit(response: Response): Promise<SubmitEnvelope> {
  return (await response.json()) as SubmitEnvelope;
}

describe("POST /api/takedown", () => {
  it("拿到一张工单，状态是 received，带承诺时限", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleTakedownSubmit(
      { DB: fake.db, SESSION_SECRET: SECRET },
      submitRequest({ repo: "Limccn/Vessel", reason: " 我想下架 " }),
      TOPICS,
    );

    expect(response.status).toBe(201);
    const payload = (await readSubmit(response)).data;
    expect(payload?.status).toBe("received");
    expect(payload?.slaHours).toBe(24);
    expect(payload?.ticket).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const row = fake.takedowns.get(payload?.ticket ?? "");
    expect(row?.full_name).toBe("limccn/vessel");
    expect(row?.reason).toBe("我想下架");
  });

  it("工单号每次都不同", async () => {
    const fake = createFakeCollectionDb();
    const env = { DB: fake.db, SESSION_SECRET: SECRET };

    const first = await readSubmit(await handleTakedownSubmit(env, submitRequest({ repo: "a/b" }), TOPICS));
    const second = await handleTakedownSubmit(
      env,
      submitRequest({ repo: "a/b" }, "203.0.113.8"),
      TOPICS,
    );

    expect((await readSubmit(second)).data?.ticket).not.toBe(first.data?.ticket);
  });

  it("提交不会自动隐藏仓库", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        {
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
        },
      ],
    });

    await handleTakedownSubmit(
      { DB: fake.db, SESSION_SECRET: SECRET },
      submitRequest({ repo: "limccn/vessel" }),
      TOPICS,
    );

    expect(fake.repos.get("limccn/vessel")?.hidden_by).toBeNull();
  });

  it("只存 HMAC 过的来源，不存 IP 原文", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleTakedownSubmit(
      { DB: fake.db, SESSION_SECRET: SECRET },
      submitRequest({ repo: "a/b" }, "198.51.100.4"),
      TOPICS,
    );
    const ticket = (await readSubmit(response)).data?.ticket ?? "";

    const stored = fake.takedowns.get(ticket)?.ip_hash;
    expect(stored).toBeTruthy();
    expect(stored).not.toContain("198.51.100.4");
  });

  it("仓库名不合法 → 400", async () => {
    const fake = createFakeCollectionDb();

    for (const repo of ["", "vessel", "a/b/c", "  /  "]) {
      const response = await handleTakedownSubmit(
        { DB: fake.db, SESSION_SECRET: SECRET },
        submitRequest({ repo }),
        TOPICS,
      );
      expect(response.status).toBe(400);
      expect((await readSubmit(response)).error?.code).toBe("invalid_payload");
    }
    expect(fake.takedowns.size).toBe(0);
  });

  it("请求体不是 JSON → 400", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleTakedownSubmit(
      { DB: fake.db, SESSION_SECRET: SECRET },
      submitRequest("not json"),
      TOPICS,
    );

    expect(response.status).toBe(400);
  });

  it("同一来源一小时内第 6 次 → 429", async () => {
    const fake = createFakeCollectionDb();
    const env = { DB: fake.db, SESSION_SECRET: SECRET };

    for (let i = 0; i < 5; i += 1) {
      const ok = await handleTakedownSubmit(env, submitRequest({ repo: `a/r${i}` }), TOPICS);
      expect(ok.status).toBe(201);
    }

    const blocked = await handleTakedownSubmit(env, submitRequest({ repo: "a/r5" }), TOPICS);
    expect(blocked.status).toBe(429);
    const error = (await readSubmit(blocked)).error;
    expect(error?.code).toBe("rate_limited");
    expect(error?.retryAfter).toBe(3600);

    /* 换了来源就重新计数 —— 限的是「一个来源」，不是「全站」。 */
    const other = await handleTakedownSubmit(
      env,
      submitRequest({ repo: "a/r6" }, "203.0.113.99"),
      TOPICS,
    );
    expect(other.status).toBe(201);
  });

  it("缺 DB → 503，不是假装收下了", async () => {
    const response = await handleTakedownSubmit(
      { SESSION_SECRET: SECRET },
      submitRequest({ repo: "a/b" }),
      TOPICS,
    );

    expect(response.status).toBe(503);
    expect((await readSubmit(response)).error?.code).toBe("upstream_unavailable");
  });
});

describe("GET /api/takedown/:ticket", () => {
  it("凭工单号读得到状态", async () => {
    const fake = createFakeCollectionDb();
    const env = { DB: fake.db, SESSION_SECRET: SECRET };

    const created = await readSubmit(
      await handleTakedownSubmit(env, submitRequest({ repo: "a/b" }), TOPICS),
    );
    const ticket = created.data?.ticket ?? "";

    const response = await handleTakedownStatus(env, ticket, TOPICS);
    expect(response.status).toBe(200);
    expect((await response.json() as StatusEnvelope).data).toMatchObject({
      status: "received",
      createdAt: created.data?.createdAt,
    });
  });

  it("没有这张工单 → 404", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleTakedownStatus(
      { DB: fake.db, SESSION_SECRET: SECRET },
      "nope-nope-nope",
      TOPICS,
    );

    expect(response.status).toBe(404);
    expect((await response.json() as StatusEnvelope).error?.code).toBe("repo_unavailable");
  });

  it("空工单号 → 400，且不打 DB", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleTakedownStatus({ DB: fake.db }, "   ", TOPICS);

    expect(response.status).toBe(400);
    expect(fake.queries).toHaveLength(0);
  });
});

describe("测量埋点", () => {
  it("收下工单记一次 takedown_submit:received", async () => {
    const fake = createFakeCollectionDb();
    const pending: Promise<unknown>[] = [];

    const response = await handleTakedownSubmit(
      { DB: fake.db, SESSION_SECRET: SECRET },
      submitRequest({ repo: "limccn/vessel" }),
      TOPICS,
      { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) },
    );
    await Promise.all(pending);

    expect(response.status).toBe(201);
    const [key, value] = [...fake.metrics.entries()][0] ?? [];
    expect(key).toMatch(/\|takedown_submit\|received$/);
    expect(value).toBe(1);
  });

  it("被拒的提交不记 —— 没有工单就没有一次误收录投诉", async () => {
    const fake = createFakeCollectionDb();

    await handleTakedownSubmit(
      { DB: fake.db, SESSION_SECRET: SECRET },
      submitRequest({ repo: "not a repo" }),
      TOPICS,
    );

    expect(fake.metrics.size).toBe(0);
  });
});
