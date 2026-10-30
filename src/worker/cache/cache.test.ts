// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Envelope } from "@/shared/contract";
import { LOCALES } from "@/shared/i18n";
import { cacheGet, cacheSet } from "@/worker/cache/store";
import {
  REPO_CACHE_TTL_SECONDS,
  USER_CACHE_TTL_SECONDS,
  boardCacheKey,
  boardCacheKeys,
  isExpired,
  repoCacheKey,
  userCacheKey,
  userCacheKeys,
} from "@/worker/cache/ttl";
import { createFakeDb } from "@/worker/test/fakeD1";

const FETCHED_AT = "2024-01-01T00:00:00.000Z";

const ENVELOPE: Envelope<{ hello: string }> = {
  data: { hello: "world" },
  completeness: "complete",
  missingPages: [],
  readAt: FETCHED_AT,
};

describe("缓存键", () => {
  it("一律小写并去掉首尾空白 —— GitHub 的 login 不区分大小写", () => {
    expect(userCacheKey("  LimCCN ", "en")).toBe("user:limccn:en");
    expect(repoCacheKey(" LimCCN ", "Repo-Vessel")).toBe("repo:limccn/repo-vessel");
  });

  it("用户与仓库的键不会撞在一起", () => {
    expect(userCacheKey("a/b", "en")).not.toBe(repoCacheKey("a", "b"));
  });

  it("语言进用户与榜单的键 —— 一份信封只对一种语言成立", () => {
    expect(userCacheKey("limccn", "zh-Hant")).toBe("user:limccn:zh-Hant");
    expect(boardCacheKey("forks", "ja")).toBe("board:forks:ja");
    expect(userCacheKey("limccn", "en")).not.toBe(userCacheKey("limccn", "ja"));
  });

  it("全部语言的键：每种语言一条，不重不漏", () => {
    expect(userCacheKeys("LimCCN")).toEqual(LOCALES.map((locale) => `user:limccn:${locale}`));
    expect(boardCacheKeys("embers")).toEqual(LOCALES.map((locale) => `board:embers:${locale}`));
    expect(new Set(userCacheKeys("limccn")).size).toBe(LOCALES.length);
    expect(new Set(boardCacheKeys("embers")).size).toBe(LOCALES.length);
  });
});

describe("isExpired", () => {
  const now = Date.parse("2024-01-01T12:00:00.000Z");

  it("TTL 之内是新鲜的", () => {
    expect(isExpired("2024-01-01T06:00:00.000Z", USER_CACHE_TTL_SECONDS, now)).toBe(false);
  });

  it("超过 TTL 就是过期", () => {
    expect(isExpired("2023-12-31T05:00:00.000Z", USER_CACHE_TTL_SECONDS, now)).toBe(true);
  });

  it("时间戳读不出来时当作过期 —— 宁可多读一次", () => {
    expect(isExpired("不是时间", USER_CACHE_TTL_SECONDS, now)).toBe(true);
  });

  it("单仓库的 TTL 比用户长", () => {
    expect(REPO_CACHE_TTL_SECONDS).toBeGreaterThan(USER_CACHE_TTL_SECONDS);
  });
});

describe("cacheGet / cacheSet", () => {
  it("没有 DB 时是未命中，不抛错", async () => {
    await expect(cacheGet(undefined, "user:x")).resolves.toBeNull();
    await expect(cacheSet(undefined, "user:x", ENVELOPE, FETCHED_AT)).resolves.toBeUndefined();
  });

  it("写进去再读出来，payload 与 fetchedAt 都保持不变", async () => {
    const { db } = createFakeDb();
    await cacheSet(db, "user:limccn", ENVELOPE, FETCHED_AT);

    const entry = await cacheGet(db, "user:limccn");
    expect(entry?.fetchedAt).toBe(FETCHED_AT);
    expect(entry === null ? null : JSON.parse(entry.payload)).toEqual(ENVELOPE);
  });

  it("同键再写是覆盖，不是新增一行", async () => {
    const { db, rows } = createFakeDb();
    await cacheSet(db, "user:limccn", ENVELOPE, "2024-01-01T00:00:00.000Z");
    await cacheSet(db, "user:limccn", ENVELOPE, "2024-01-02T00:00:00.000Z");

    expect(rows.size).toBe(1);
    expect(rows.get("user:limccn")?.fetched_at).toBe("2024-01-02T00:00:00.000Z");
  });

  it("failed 信封不写缓存 —— 一次故障不该被延长成一个 TTL", async () => {
    const { db, rows } = createFakeDb();
    const failed: Envelope<never> = {
      data: null,
      completeness: "failed",
      missingPages: [],
      readAt: null,
    };
    await cacheSet(db, "user:limccn", failed, "2024-01-01T00:00:00.000Z");
    expect(rows.size).toBe(0);
  });

  it("表不存在时读写都降级成未命中，不产生 500", async () => {
    const { db } = createFakeDb({ fail: true });
    await expect(cacheGet(db, "user:limccn")).resolves.toBeNull();
    await expect(cacheSet(db, "user:limccn", ENVELOPE, FETCHED_AT)).resolves.toBeUndefined();
  });

  it("缓存内容坏了时，读到的仍是原来的字符串（由调用方决定怎么处理）", async () => {
    const { db } = createFakeDb({
      seed: { "user:limccn": { payload: "{不是 JSON", fetchedAt: "2024-01-01T00:00:00.000Z" } },
    });
    const entry = await cacheGet(db, "user:limccn");
    expect(entry?.payload).toBe("{不是 JSON");
  });
});
