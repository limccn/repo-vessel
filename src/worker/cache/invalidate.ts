/**
 * 可见性变化时的缓存失效。
 *
 * 只有一种事件需要它：一个仓库**从可见变成不可见**（或反过来）。这时三处缓存
 * 仍然说着旧话 ——
 *
 *   - `user:<login>:<locale>` 的鉴定信封里还列着它；
 *   - `board:<id>:<locale>` 的榜单里还排着它；
 *   - `/og/u/<login>?lang=<locale>` 的 PNG 上还画着它的数字。
 *
 * **每一处都有四种语言。** 缓存里的称号、榜单说明、卡片文案都是翻好的句子，
 * 所以同一份事实有四份副本；漏删一种语言，那个语言的读者就会继续看到刚被
 * 隐藏的仓库，最长一个 TTL。
 *
 * 不失效别人的 `user:` 键：别人的鉴定结果里本来就不会出现这个仓库。
 *
 * 删除失败一律吞掉 —— 缓存最多旧一个 TTL（榜单 1 小时、用户 6 小时），
 * 而「删失败就报 500」会让一次成功的隐藏看起来像失败。
 */

import { BOARD_IDS } from "@/shared/ids";
import { LOCALES } from "@/shared/i18n";
import { boardCacheKeys, userCacheKeys } from "@/worker/cache/ttl";
import type { D1Like } from "@/worker/env";

/** 三张榜 × 四种语言 —— 一次可见性变化要清掉的全部榜单键。 */
export const BOARD_CACHE_KEYS: readonly string[] = BOARD_IDS.flatMap((id) =>
  boardCacheKeys(id),
);

export async function deleteCacheKeys(
  db: D1Like | undefined,
  keys: readonly string[],
): Promise<void> {
  if (!db) return;
  await Promise.all(
    keys.map(async (key) => {
      try {
        await db.prepare("DELETE FROM repo_cache WHERE cache_key = ?").bind(key).run();
      } catch {
        /* 缓存是旁路。 */
      }
    }),
  );
}

export async function invalidateBoards(db: D1Like | undefined): Promise<void> {
  await deleteCacheKeys(db, BOARD_CACHE_KEYS);
}

/** `/og/u/...` 的缓存键写死在站点 origin 上 —— 与 `share/routes.ts` 拼的一致。 */
const OG_CACHE_ORIGIN = "https://repovessel.lmlh.net";

/**
 * 删掉某个用户的 OG 图缓存。
 *
 * 键的形状必须和 `share/routes.ts` **逐字节一致**：
 * `/og/u/<小写 login>?lang=<locale>`，四种语言各一份（默认语言也带 `?lang=`，
 * 因为那边总是写进去）。大小写归一后其实是同一个键，仍然两个都删。
 */
export async function deleteOgCache(owner: string): Promise<void> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return;
  for (const login of new Set([owner, owner.toLowerCase()])) {
    for (const locale of LOCALES) {
      try {
        await cache.delete(`${OG_CACHE_ORIGIN}/og/u/${login}?lang=${locale}`);
      } catch {
        /* 同上。 */
      }
    }
  }
}

/**
 * 一个仓库的可见性变了。
 *
 * `owner` 用来清榜单与该所有者的 OG 图；`login` 是该所有者的登录名（认领时
 * 知道，匿名下架时不知道）—— 不知道就只清 `owner` 推出来的那个键。
 */
export async function bustVisibility(
  db: D1Like | undefined,
  owner: string,
  login: string | null,
): Promise<void> {
  const account = (login ?? owner).trim().toLowerCase();
  await Promise.all([
    deleteCacheKeys(db, [...userCacheKeys(account), ...BOARD_CACHE_KEYS]),
    deleteOgCache(owner),
  ]);
}
