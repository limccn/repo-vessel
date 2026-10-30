/**
 * 信封 → 卡片事实。
 *
 * OG 图与 `/api/inspect` 读的是同一份 `InspectPayload`，但卡片要的字段少得多，
 * 而且**读不到时必须整片变成未知**：`null` 信封里没有任何东西可以画，除了
 * 请求里带来的那个用户名。所以这里只做一件事 —— 把「有数据」与「没数据」
 * 分别映射成 `OgCardFacts`，不猜、不补默认值。
 *
 * 单独成文件是为了不把 resvg 的 wasm 拖进单测：`render.ts` 依赖 wasm，
 * 而这里只是纯数据搬运。
 */

import type { Envelope, InspectPayload } from "@/shared/contract";
import { tierFor } from "@/shared/tier";
import type { OgCardFacts } from "./svg";

export function factsFor(
  envelope: Envelope<InspectPayload> | null,
  login: string,
  host: string | null,
): OgCardFacts {
  const data = envelope?.data ?? null;
  if (envelope === null || data === null) {
    // 读失败：用户名是请求给的，其余一个都不知道。
    return {
      login,
      titleId: null,
      tier: null,
      enrolledCount: null,
      longestDormantDays: null,
      readAt: null,
      host,
    };
  }

  return {
    // 读到了就用 GitHub 的规范写法，而不是用户输入的大小写。
    login: data.account.login,
    titleId: data.title.id,
    tier: tierFor(data.enrolledCount),
    enrolledCount: data.enrolledCount,
    longestDormantDays: data.stats.longestDormantDays,
    readAt: envelope.readAt,
    host,
  };
}
