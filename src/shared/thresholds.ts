/**
 * Every threshold in the product, in one object.
 *
 * The threshold panel the user reads (§5.5 of the interaction PRD) and the thresholds the code
 * applies are the same numbers — otherwise the site publishes a rule it does not actually use.
 *
 * Imported by the Worker and the SPA. Never re-declared.
 */
export const THRESHOLDS = {
  /* ---- dormancy bands (§5.2) ---- */
  /** 沉睡 ≥ 181 天 → 刚刚安静 */
  quietMinDays: 181,
  /** 沉睡 ≥ 365 天 → 深度待机 */
  standbyMinDays: 365,
  /** 沉睡 < 1095 天 → 深度待机 */
  standbyMaxDays: 1094,
  /** 沉睡 ≥ 1095 天 → 时间胶囊 */
  capsuleMinDays: 1095,

  /* ---- 余烬未熄 ---- */
  emberMinStars: 32,
  emberMinDays: 365,

  /* ---- 称号 ---- */
  ideaSowerMinOriginals: 8,
  ideaSowerMinRatio: 0.7,
  forkVoyagerMinRatio: 0.5,
  forkVoyagerMinForks: 3,
  visitorMinRepos: 3,

  /* ---- freshness & timeouts ---- */
  staleAfterHours: 24,
  softTimeoutMs: 3000,
  hardTimeoutMs: 8000,

  /* ---- ceilings ---- */
  maxRepos: 1000,
  boardMinDormantDays: 181,

  /* ---- the rarity ladder (视觉层 · 沉睡越久越稀有) ---- */
  /** ≥ 181 天 → 稀有 */
  rarityRareMinDays: 181,
  /** ≥ 365 天 → 史诗 */
  rarityEpicMinDays: 365,
  /** ≥ 1095 天 → 传说 */
  rarityLegendaryMinDays: 1095,

  /* ---- 灵龛充能等级（用户侧 · 带主题的公开仓库数） ---- */
  /** ≥ 1 个 → Ⅰ 阶 */
  tierIMinRepos: 1,
  /** ≥ 5 个 → Ⅱ 阶 */
  tierIIMinRepos: 5,
  /** ≥ 10 个 → Ⅲ 阶 */
  tierIIIMinRepos: 10,
  /** ≥ 25 个 → Ⅳ 阶 */
  tierIVMinRepos: 25,
} as const;

export type Thresholds = typeof THRESHOLDS;
