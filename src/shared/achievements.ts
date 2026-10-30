/**
 * 成就徽章 —— 由「带主题的公开仓库数」派生的两枚徽章。
 *
 * 成就不引入新阈值：它们落在既有的灵龛充能阶梯上（Ⅲ 阶 / Ⅳ 阶）。
 * 「Urn of Repos」是灵龛积满灰烬的那一刻，「Repo Vessel」是灵龛升格为器、
 * 装得下更多项目的那一刻 —— 这与口号的后半句说的是同一件事。
 *
 * 三条硬规则：
 *
 * 1. **未知不是零。** 数量读不到时 `earnedAchievements` 返回 `null`，
 *    不是空数组；UI 必须渲染「? 未知」，不能说「0 枚」或「未达成」。
 * 2. **徽章只陈述条件，不评价人。** 文案里没有「失败」「最懒」这类词。
 * 3. **判定是纯函数。** 没有持久化的「已颁发」记录 —— 徽章不是资产，
 *    是当前状态的另一种读法；仓库数掉下去，徽章也就跟着不再显示。
 */

import { getActiveLocale, t, type Locale } from "./i18n";
import { THRESHOLDS } from "./thresholds";

export type AchievementId = "urn-of-repos" | "repo-vessel";

export interface AchievementDef {
  id: AchievementId;
  /** 解锁所需的最少带主题公开仓库数。 */
  minRepos: number;
  /** 成就名。徽章上刻的那个拉丁名 —— 不翻译。 */
  name: string;
  /**
   * 条件说明的 **msgid**（带 `{n}` 占位符）。
   * 渲染请用 `achievementRequirement(def, locale)`。
   */
  requirement: string;
  /** 徽章原图（`public/` 下的路径）。下载用，不进页面。 */
  badgeSrc: string;
  /**
   * 页面上的缩略图。原图 887×887、约 900KB，而面板里只占 64px ——
   * 直接用原图，一张 Dashboard 就要拉 1.8MB。所以另存两档缩略图，
   * 用 `srcSet` 交给浏览器按 DPR 挑。
   */
  thumbSrc: string;
  thumbSrcSet: string;
  /** 下载时的文件名。 */
  downloadName: string;
  /** 徽章替代文本的 msgid。渲染请用 `achievementBadgeAlt(def, locale)`。 */
  badgeAlt: string;
}

/**
 * 全部成就，从低到高。
 *
 * 顺序就是展示顺序：先看到最近的一枚，再看到远的一枚。
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "urn-of-repos",
    minRepos: THRESHOLDS.tierIIIMinRepos,
    name: "Urn of Repos",
    requirement: "带主题的公开仓库达到 {n} 个。",
    badgeSrc: "/badges/urn-of-repos.png",
    thumbSrc: "/badges/urn-of-repos-128.png",
    thumbSrcSet: "/badges/urn-of-repos-128.png 128w, /badges/urn-of-repos-192.png 192w",
    downloadName: "urn-of-repos.png",
    badgeAlt: "Urn of Repos 成就徽章：紫色灵龛，紫色火光",
  },
  {
    id: "repo-vessel",
    minRepos: THRESHOLDS.tierIVMinRepos,
    name: "Repo Vessel",
    requirement: "带主题的公开仓库达到 {n} 个。",
    badgeSrc: "/badges/repo-vessel.png",
    thumbSrc: "/badges/repo-vessel-128.png",
    thumbSrcSet: "/badges/repo-vessel-128.png 128w, /badges/repo-vessel-192.png 192w",
    downloadName: "repo-vessel.png",
    badgeAlt: "Repo Vessel 成就徽章：金色灵龛，绿色火焰",
  },
];

/** 成就区的块级文案。与 `ACHIEVEMENTS` 分开 —— 这些字不属于任何一枚。 */
export const ACHIEVEMENT_COPY = {
  label: "成就徽章",
  unknown: "这次没有读到带主题的公开仓库数，无法判断成就。",
  earned: "已达成",
  locked: "未达成",
  download: "下载徽章",
  hint: "徽章达成即颁发，可以下载，也可以分享。",
} as const;

export function achievementCopy(locale: Locale = getActiveLocale()): {
  label: string;
  unknown: string;
  earned: string;
  locked: string;
  download: string;
  hint: string;
} {
  const source = ACHIEVEMENT_COPY;
  return {
    label: t(source.label, undefined, locale),
    unknown: t(source.unknown, undefined, locale),
    earned: t(source.earned, undefined, locale),
    locked: t(source.locked, undefined, locale),
    download: t(source.download, undefined, locale),
    hint: t(source.hint, undefined, locale),
  };
}

export function achievementRequirement(
  def: AchievementDef,
  locale: Locale = getActiveLocale(),
): string {
  return t(def.requirement, { n: def.minRepos }, locale);
}

export function achievementBadgeAlt(
  def: AchievementDef,
  locale: Locale = getActiveLocale(),
): string {
  return t(def.badgeAlt, undefined, locale);
}

/** 还差几个仓库的那句话。 */
export function achievementRemainingCopy(
  reposLeft: number,
  locale: Locale = getActiveLocale(),
): string {
  return t("再收 {n} 个仓库解锁。", { n: reposLeft }, locale);
}

/** 按 id 取定义。 */
export function achievementById(id: AchievementId): AchievementDef {
  const def = ACHIEVEMENTS.find((item) => item.id === id);
  if (!def) throw new Error(`未知成就：${id}`);
  return def;
}

/**
 * 已达成 / 未达成 / 未知。
 *
 * - `null` / `undefined` → `null`（未知）—— **不是**空数组。
 * - 否则返回已达成成就的 id，从低到高。
 */
export function earnedAchievements(
  enrolledCount: number | null | undefined,
): AchievementId[] | null {
  if (enrolledCount == null) return null;
  return ACHIEVEMENTS.filter((def) => enrolledCount >= def.minRepos).map(
    (def) => def.id,
  );
}

/**
 * 距离解锁还差几个仓库。
 *
 * - 数量未知 → `null`（未知，不是「差 10 个」）。
 * - 已达成 → `0`。
 */
export function achievementRemaining(
  enrolledCount: number | null | undefined,
  def: AchievementDef,
): number | null {
  if (enrolledCount == null) return null;
  return Math.max(0, def.minRepos - enrolledCount);
}
