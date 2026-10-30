// @vitest-environment node

import { describe, expect, it } from "vitest";
import { handleBoard } from "@/worker/api/board";
import type { ApiError, BoardPayload, Envelope } from "@/shared/contract";
import { boardCacheKey } from "@/worker/cache/ttl";
import type { CollectedRepoRow } from "@/worker/db/schema";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const TOPICS = ["repo-vessel", "urn-of-repos"];
/** 断言里的句子都是简体中文原文 —— 显式传它，别依赖默认语言。 */
const ZH = "zh-Hans" as const;

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
    description: "一只灵龛",
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

type BoardEnvelope = Envelope<BoardPayload> & { error?: ApiError };

async function readBoard(response: Response): Promise<BoardEnvelope> {
  return (await response.json()) as BoardEnvelope;
}

describe("GET /api/board/:board", () => {
  it("未知榜单返回 400，而不是一个空榜单", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleBoard({ DB: fake.db }, undefined, "most-lazy", TOPICS, ZH);

    expect(response.status).toBe(400);
    expect((await readBoard(response)).error?.code).toBe("invalid_board");
  });

  it("没有收录时是一个完整的空榜单", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleBoard({ DB: fake.db }, undefined, "longest-sleep", TOPICS, ZH);
    const envelope = await readBoard(response);

    expect(response.status).toBe(200);
    expect(envelope.completeness).toBe("complete");
    expect(envelope.data?.entries).toEqual([]);
    expect(envelope.data?.criteria).toContain("repo-vessel");
  });

  it("没有 D1 绑定时是失败，不是空榜单", async () => {
    const response = await handleBoard({}, undefined, "longest-sleep", TOPICS, ZH);
    const envelope = await readBoard(response);

    expect(envelope.completeness).toBe("failed");
    expect(envelope.data).toBeNull();
    expect(envelope.error?.code).toBe("upstream_unavailable");
  });

  it("只列出已核实的行，并按沉睡从久到近编号", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/newer", owner: "a", pushed_at: "2024-01-01T00:00:00.000Z" }),
        row({ full_name: "b/older", owner: "b", pushed_at: "2022-01-01T00:00:00.000Z" }),
        row({ full_name: "c/hidden", owner: "c", hidden_by: "owner" }),
      ],
    });

    const envelope = await readBoard(
      await handleBoard({ DB: fake.db }, undefined, "longest-sleep", TOPICS, ZH),
    );

    expect(envelope.data?.entries.map((entry) => entry.repo.fullName)).toEqual([
      "b/older",
      "a/newer",
    ]);
    expect(envelope.data?.entries[0]?.rank).toBe(1);
    expect(envelope.data?.entries[0]?.dormantDays).toBeGreaterThan(365);
  });

  it("余烬榜按 Star 降序", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/some", owner: "a", star_count: 40 }),
        row({ full_name: "b/many", owner: "b", star_count: 900 }),
      ],
    });

    const envelope = await readBoard(
      await handleBoard({ DB: fake.db }, undefined, "embers", TOPICS, ZH),
    );

    expect(envelope.data?.entries.map((entry) => entry.repo.fullName)).toEqual([
      "b/many",
      "a/some",
    ]);
  });

  it("缓存命中时直接返回，且读取时间保持是那次查询的时刻", async () => {
    const fake = createFakeCollectionDb();
    const cached: Envelope<BoardPayload> = {
      data: {
        id: "forks",
        name: "Fork 漂流榜",
        description: "缓存里的那一份",
        criteria: "x",
        entries: [],
        delistedCount: 3,
      },
      completeness: "complete",
      missingPages: [],
      readAt: "2026-10-31T00:00:00.000Z",
    };
    fake.cache.set(boardCacheKey("forks", ZH), {
      payload: JSON.stringify(cached),
      fetched_at: new Date().toISOString(),
    });

    const envelope = await readBoard(
      await handleBoard({ DB: fake.db }, undefined, "forks", TOPICS, ZH),
    );

    expect(envelope.readAt).toBe("2026-10-31T00:00:00.000Z");
    expect(envelope.data?.delistedCount).toBe(3);
  });

  it("名称、说明与收录条件随语言变，阈值仍是同一份", async () => {
    const fake = createFakeCollectionDb();

    const en = await readBoard(
      await handleBoard({ DB: fake.db }, undefined, "longest-sleep", TOPICS, "en"),
    );
    const embers = await readBoard(
      await handleBoard({ DB: fake.db }, undefined, "embers", TOPICS, "en"),
    );
    const ja = await readBoard(await handleBoard({ DB: fake.db }, undefined, "forks", TOPICS, "ja"));

    expect(en.data?.name).toBe("Longest Slumber");
    expect(en.data?.description).toBe(
      "They have not gone far. They have merely slept long.",
    );
    expect(en.data?.criteria).toBe(
      "To be counted: carries the repo-vessel or urn-of-repos topic and has slept ≥ 181 days.",
    );
    expect(embers.data?.criteria).toBe(
      "To be counted: carries the repo-vessel or urn-of-repos topic, dormant ≥ 365 days, and ≥ 32 stars.",
    );
    /* 日语里主题的「或」也翻过来了 —— 主题本身（标识符）不变。 */
    expect(ja.data?.name).toBe("Fork 漂流ランキング");
    expect(ja.data?.criteria).toContain("repo-vessel または urn-of-repos");
  });

  it("榜单缓存按语言分开：en 请求不会读到 zh-Hans 的缓存", async () => {
    const fake = createFakeCollectionDb();
    const cached: Envelope<BoardPayload> = {
      data: {
        id: "longest-sleep",
        name: "最长沉睡榜",
        description: "缓存里的那一份",
        criteria: "x",
        entries: [],
        delistedCount: 3,
      },
      completeness: "complete",
      missingPages: [],
      readAt: "2026-10-31T00:00:00.000Z",
    };
    fake.cache.set(boardCacheKey("longest-sleep", ZH), {
      payload: JSON.stringify(cached),
      fetched_at: new Date().toISOString(),
    });

    const en = await readBoard(
      await handleBoard({ DB: fake.db }, undefined, "longest-sleep", TOPICS, "en"),
    );

    // 现查的一份：空榜、说明是英文，而不是那份中文缓存。
    expect(en.readAt).not.toBe("2026-10-31T00:00:00.000Z");
    expect(en.data?.delistedCount).toBe(0);
    expect(en.data?.name).toBe("Longest Slumber");
    // 中文那份原样留着，en 自己写了一份。
    expect(fake.cache.has(boardCacheKey("longest-sleep", ZH))).toBe(true);
    expect(fake.cache.has(boardCacheKey("longest-sleep", "en"))).toBe(true);
  });
});
