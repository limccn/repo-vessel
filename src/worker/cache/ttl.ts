/**
 * 缓存的几个时长。
 *
 * 这是命中率与新鲜度的交易，不是正确性的一部分：缓存丢了，功能仍然正确，
 * 只是更慢、更费配额。所以这些数字都可以放心地短一点。
 */

import type { BoardId } from "@/shared/contract";
import { LOCALES, type Locale } from "@/shared/i18n";

/** 用户查询：元数据天级变化，6 小时足够。 */
export const USER_CACHE_TTL_SECONDS = 6 * 60 * 60;

/** 单仓库：变化更少，24 小时。 */
export const REPO_CACHE_TTL_SECONDS = 24 * 60 * 60;

/**
 * 榜单：数据源是 D1，本身已经是收集的结果。1 小时只是省掉重复查询，
 * 任何可见性变化都会主动删键（`src/worker/cache/invalidate.ts`），
 * 所以 TTL 不需要为「隐藏何时生效」负责。
 */
export const BOARD_CACHE_TTL_SECONDS = 60 * 60;

/**
 * 缓存键。一律小写 —— GitHub 的 login 与仓库名都不区分大小写。
 *
 * **语言必须进键。** 信封里的称号名称与证据是**已经翻好的句子**，榜单的
 * 名称与收录条件也是：一个语言的信封喂给另一个语言，就是把中文句子当成
 * 英文页面的事实。旧格式（没有语言段）的条目会自然过期，不需要迁移。
 */
export function userCacheKey(login: string, locale: Locale): string {
  return `user:${login.trim().toLowerCase()}:${locale}`;
}

/** 单仓库没有服务端散文（只有 GitHub 的字段），所以不带语言。 */
export function repoCacheKey(owner: string, name: string): string {
  return `repo:${owner.trim().toLowerCase()}/${name.trim().toLowerCase()}`;
}

export function boardCacheKey(id: BoardId, locale: Locale): string {
  return `board:${id}:${locale}`;
}

/**
 * 某个 login / 某张榜的全部语言的键。
 *
 * 失效必须删**每**一种语言 —— 少删一种，那个语言的读者就会继续看到刚被
 * 隐藏的仓库，最长一个 TTL（榜单 1 小时、用户 6 小时）。
 */
export function userCacheKeys(login: string): string[] {
  return LOCALES.map((locale) => userCacheKey(login, locale));
}

export function boardCacheKeys(id: BoardId): string[] {
  return LOCALES.map((locale) => boardCacheKey(id, locale));
}

/** `fetchedAt` 是否已经超过 TTL。时间戳读不出来时当作过期（宁可多读一次）。 */
export function isExpired(
  fetchedAt: string,
  ttlSeconds: number,
  now: number = Date.now(),
): boolean {
  const fetched = Date.parse(fetchedAt);
  if (Number.isNaN(fetched)) return true;
  return now - fetched > ttlSeconds * 1000;
}
