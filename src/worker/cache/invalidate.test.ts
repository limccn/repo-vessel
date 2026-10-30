// @vitest-environment node
/**
 * 可见性变化的缓存失效。
 *
 * 缓存里的称号、榜单说明与 OG 图都是**翻好的句子**，所以同一份事实有四种语言
 * 的副本。这里守的就是「全部清掉」—— 漏一种语言，那个语言的读者会继续看到
 * 刚被隐藏的仓库，最长一个 TTL。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { BOARD_IDS } from "@/shared/ids";
import { LOCALES } from "@/shared/i18n";
import {
  BOARD_CACHE_KEYS,
  bustVisibility,
  invalidateBoards,
} from "@/worker/cache/invalidate";
import { boardCacheKey, userCacheKey } from "@/worker/cache/ttl";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const FETCHED_AT = "2026-11-01T00:00:00.000Z";
/** 与 `share/routes.ts` 拼出来的缓存键同一个 origin。 */
const OG_ORIGIN = "https://repovessel.lmlh.net";

function cacheEntry() {
  return { payload: "{}", fetched_at: FETCHED_AT };
}

function stubOgCache() {
  const del = vi.fn(async (_key: string) => true);
  vi.stubGlobal("caches", { default: { delete: del } });
  return del;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("缓存失效", () => {
  it("bustVisibility 清掉四种语言的用户键、十二张榜单键与每一张 OG 图", async () => {
    const fake = createFakeCollectionDb();
    for (const locale of LOCALES) {
      fake.cache.set(userCacheKey("limccn", locale), cacheEntry());
      for (const id of BOARD_IDS) {
        fake.cache.set(boardCacheKey(id, locale), cacheEntry());
      }
    }
    // 别人的鉴定结果里本来就不会出现这个仓库 —— 不能一起删。
    fake.cache.set(userCacheKey("someone-else", "en"), cacheEntry());
    const del = stubOgCache();

    await bustVisibility(fake.db, "LimCCN", null);

    expect([...fake.cache.keys()].filter((key) => key.startsWith("user:limccn"))).toEqual([]);
    expect([...fake.cache.keys()].filter((key) => key.startsWith("board:"))).toEqual([]);
    expect(fake.cache.has(userCacheKey("someone-else", "en"))).toBe(true);

    for (const locale of LOCALES) {
      expect(del).toHaveBeenCalledWith(`${OG_ORIGIN}/og/u/limccn?lang=${locale}`);
    }
    // owner 的大小写两种写法都删（归一后其实是同一个键）。
    expect(del).toHaveBeenCalledTimes(LOCALES.length * 2);
  });

  it("榜单失效清掉每一张榜的每一种语言，用户键不动", async () => {
    const fake = createFakeCollectionDb();
    for (const key of BOARD_CACHE_KEYS) fake.cache.set(key, cacheEntry());
    fake.cache.set(userCacheKey("limccn", "en"), cacheEntry());

    await invalidateBoards(fake.db);

    expect(BOARD_CACHE_KEYS).toHaveLength(BOARD_IDS.length * LOCALES.length);
    expect([...fake.cache.keys()].filter((key) => key.startsWith("board:"))).toEqual([]);
    expect(fake.cache.has(userCacheKey("limccn", "en"))).toBe(true);
  });

  it("没有 D1、没有 Cache API 时安静地什么都不做", async () => {
    await expect(bustVisibility(undefined, "limccn", null)).resolves.toBeUndefined();
    await expect(invalidateBoards(undefined)).resolves.toBeUndefined();
  });
});
