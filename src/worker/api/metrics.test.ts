// @vitest-environment node
/**
 * `POST /api/metrics/event` —— 埋点的四道校验与「失败也是 204」。
 *
 * 这个文件守两条底线：
 *   1. **只收受控词汇。** 事件名、dim 都必须落在 `src/shared/metrics.ts` 的
 *      词表里；用户名、路径、URL 这种自由文本进不来。
 *   2. **埋点永不打断浏览。** 没有 DB、D1 写失败，都还是 204 —— 指标缺席时
 *      报告显示「未采集」，不会补零。
 */

import { describe, expect, it } from "vitest";
import type { ApiError } from "@/shared/contract";
import { handleMetricEvent } from "@/worker/api/metrics";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const TOPICS = ["repo-vessel", "urn-of-repos"];
const URL_UNDER_TEST = "https://repovessel.lmlh.net/api/metrics/event";

interface ErrorEnvelope {
  error?: ApiError;
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_UNDER_TEST, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readError(response: Response): Promise<ApiError | undefined> {
  return ((await response.json()) as ErrorEnvelope).error;
}

function recorded(fake: ReturnType<typeof createFakeCollectionDb>): Array<[string, number]> {
  return [...fake.metrics.entries()];
}

describe("POST /api/metrics/event", () => {
  it("合法事件回 204，没有 body，并写下一行计数", async () => {
    const fake = createFakeCollectionDb();
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };

    const response = await handleMetricEvent(
      { DB: fake.db },
      post({ event: "page_view", dim: "route=home,src=direct" }),
      TOPICS,
      ctx,
    );
    await Promise.all(pending);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-repo-topics")).toBe("repo-vessel,urn-of-repos");

    const [key, value] = recorded(fake)[0] ?? [];
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}\|page_view\|route=home,src=direct$/);
    expect(value).toBe(1);
  });

  it("同一事件累加，不新增行", async () => {
    const fake = createFakeCollectionDb();
    const event = { event: "share_card", dim: "ok" };

    await handleMetricEvent({ DB: fake.db }, post(event), TOPICS);
    await handleMetricEvent({ DB: fake.db }, post(event), TOPICS);

    expect(recorded(fake)).toHaveLength(1);
    expect(recorded(fake)[0]?.[1]).toBe(2);
  });

  it("同源 Origin 放行", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleMetricEvent(
      { DB: fake.db },
      post({ event: "topic_copy", dim: "topic=repo-vessel" }, {
        origin: "https://repovessel.lmlh.net",
      }),
      TOPICS,
    );

    expect(response.status).toBe(204);
    expect(recorded(fake)).toHaveLength(1);
  });

  it("非 POST → 405，不写任何东西", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleMetricEvent(
      { DB: fake.db },
      new Request(URL_UNDER_TEST, { method: "GET" }),
      TOPICS,
    );

    expect(response.status).toBe(405);
    expect((await readError(response))?.code).toBe("client_unsupported");
    expect(recorded(fake)).toHaveLength(0);
  });

  it("外站 Origin → 403", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleMetricEvent(
      { DB: fake.db },
      post({ event: "page_view", dim: "route=home,src=external" }, {
        origin: "https://example.com",
      }),
      TOPICS,
    );

    expect(response.status).toBe(403);
    expect((await readError(response))?.code).toBe("invalid_payload");
    expect(recorded(fake)).toHaveLength(0);
  });

  it("请求体超过 512 字节 → 413", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleMetricEvent(
      { DB: fake.db },
      post({ event: "page_view", dim: `route=home,src=${"x".repeat(600)}` }),
      TOPICS,
    );

    expect(response.status).toBe(413);
    expect((await readError(response))?.code).toBe("payload_too_large");
    expect(recorded(fake)).toHaveLength(0);
  });

  it("不是 JSON / 不是对象 → 400", async () => {
    const fake = createFakeCollectionDb();

    for (const body of ["not json", "null", "[]", '"page_view"']) {
      const response = await handleMetricEvent({ DB: fake.db }, post(body), TOPICS);
      expect(response.status).toBe(400);
      expect((await readError(response))?.code).toBe("invalid_payload");
    }
    expect(recorded(fake)).toHaveLength(0);
  });

  it("不认识的事件 → 400，服务端事件也不收", async () => {
    const fake = createFakeCollectionDb();

    for (const event of ["nope", "inspect_read", "collect_run", "", null]) {
      const response = await handleMetricEvent(
        { DB: fake.db },
        post({ event, dim: "complete" }),
        TOPICS,
      );
      expect(response.status).toBe(400);
      expect((await readError(response))?.code).toBe("invalid_payload");
    }
    expect(recorded(fake)).toHaveLength(0);
  });

  it("dim 不在该事件的词表里 → 400", async () => {
    const fake = createFakeCollectionDb();

    const bad = [
      { event: "page_view", dim: "route=/u/alice,src=direct" },
      { event: "page_view", dim: "route=home" },
      { event: "share_card", dim: "ok,user=alice" },
      { event: "topic_copy", dim: "topic=Repo Vessel" },
      { event: "page_view" },
    ];

    for (const body of bad) {
      const response = await handleMetricEvent({ DB: fake.db }, post(body), TOPICS);
      expect(response.status).toBe(400);
      expect((await readError(response))?.code).toBe("invalid_payload");
    }
    expect(recorded(fake)).toHaveLength(0);
  });

  it("没有 DB 也是 204 —— 指标不该让页面看到一个红请求", async () => {
    const response = await handleMetricEvent(
      {},
      post({ event: "page_view", dim: "route=home,src=direct" }),
      TOPICS,
    );

    expect(response.status).toBe(204);
  });

  it("D1 写失败也是 204 —— 缺迁移不是用户的错", async () => {
    const fake = createFakeCollectionDb({ fail: true });

    const response = await handleMetricEvent(
      { DB: fake.db },
      post({ event: "page_view", dim: "route=how,src=direct" }),
      TOPICS,
    );

    expect(response.status).toBe(204);
  });
});
