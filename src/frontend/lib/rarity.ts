/**
 * 稀有度 —— 「越沉越稀有」。
 *
 * 这是一个**视觉层**的等级，由沉睡天数派生。它不是产品标签：产品标签
 * （时间胶囊 / 深度待机 / …）由 Worker 计算并下发，客户端只渲染。
 *
 * 稀有度之所以可以由客户端派生，是因为它不表达任何新的事实 —— 它就是
 * 沉睡天数换了个说法，而且永远与等级词一起出现，颜色只是冗余编码。
 */

import { THRESHOLDS } from "@/shared/thresholds";
import type { RarityId } from "@/shared/ids";

/**
 * `null` 表示未知 —— 沉睡天数读不到时不给等级。
 * 未知不能退化成「普通」，那等于把「没读到」说成「刚睡下」。
 */
export function rarityOf(dormantDays: number | null): RarityId | null {
  if (dormantDays === null || !Number.isFinite(dormantDays)) return null;
  if (dormantDays >= THRESHOLDS.rarityLegendaryMinDays) return "legendary";
  if (dormantDays >= THRESHOLDS.rarityEpicMinDays) return "epic";
  if (dormantDays >= THRESHOLDS.rarityRareMinDays) return "rare";
  return "common";
}

/** 面板描边用的 CSS 变量名。 */
export function rarityEdgeVar(rarity: RarityId): string {
  return `var(--rarity-${rarity})`;
}

/** 缎带底色用的 CSS 变量名。 */
export function rarityFillVar(rarity: RarityId): string {
  switch (rarity) {
    case "legendary":
      return "var(--color-gold-faint)";
    case "epic":
      return "var(--color-arcane-faint)";
    case "rare":
      return "var(--color-teal-faint)";
    case "common":
      return "var(--color-hairline-soft)";
  }
}

/**
 * 辉光用的 CSS 变量名 —— 稀有与史诗是**卡内**的一圈内发光。
 *
 * 传说走的是卡外的金色辉光（`.cut-frame__inner--bloom`），所以这一档返回透明 ——
 * 两种辉光不叠加，一张卡上只该有一圈光。
 */
export function rarityGlowVar(rarity: RarityId): string {
  switch (rarity) {
    case "rare":
      return "var(--rarity-rare-glow)";
    case "epic":
      return "var(--rarity-epic-glow)";
    case "legendary":
    case "common":
      return "transparent";
  }
}

/** 计量条两端的颜色。永远从「安静」填向「稀有」，绝不往 0 走。 */
export function rarityMeterVars(rarity: RarityId): { from: string; to: string } {
  switch (rarity) {
    case "legendary":
      return { from: "var(--color-gold)", to: "var(--color-gold-bright)" };
    case "epic":
      return { from: "var(--color-teal)", to: "var(--color-arcane)" };
    case "rare":
      return { from: "var(--color-teal)", to: "var(--color-teal)" };
    case "common":
      return { from: "var(--color-state-unknown)", to: "var(--color-state-unknown)" };
  }
}

/**
 * 计量条填充比例。沉睡越久，条越满 —— 条越满越稀有。
 * 满格是「传说」，不是「危险」。
 */
export function rarityMeterRatio(dormantDays: number | null): number | null {
  if (dormantDays === null || !Number.isFinite(dormantDays)) return null;
  const cap = THRESHOLDS.rarityLegendaryMinDays;
  return Math.max(0, Math.min(1, dormantDays / cap));
}
