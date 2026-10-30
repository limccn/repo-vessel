/**
 * Display copy keyed by a stable id.
 *
 * The ids come from the wire (`src/shared/contract.ts`); the words live here. The client never
 * re-derives a tag or a title — it renders the label. Two implementations of the same rule would
 * drift, and then the page and the share card would disagree about the same repository.
 *
 * **中文原文就是 msgid。** 表里的字符串保持简体中文原句 —— 它们既是最初的文案，
 * 也是 `src/shared/i18n-dictionaries.ts` 的键。每个 id 配一个 locale 取值函数
 * （`tagLabel` / `titleLabel` / …），组件只调用函数，不直接读表；表只在需要
 * 颜色、星数、顺序这类**不随语言变**的属性时直接使用。
 *
 * **One documented exception:** `TierId` is *derived*, not transmitted — the wire carries the
 * enrolled count and both sides derive the tier from it with the same function
 * (`src/shared/tier.ts`). Like `RarityId`, it lives here because it is a derived id.
 */

import type {
  BoardId,
  CollectionState,
  TagId,
  TakedownStatus,
  TitleId,
  UnknownReason,
} from "./contract";
import { SLOGAN_TAIL } from "./copy";
import { getActiveLocale, t, type Locale } from "./i18n";

export type {
  BoardId,
  CollectionState,
  TagId,
  TakedownStatus,
  TitleId,
  UnknownReason,
} from "./contract";

/* -------------------------------------------------------------------------- */
/* 休眠标签                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The fixed display order (§5.2 rule 2): dormancy first, then fork and archive.
 * A repo may carry up to 3 tags; the rest fold into `+N`.
 */
export const TAG_ORDER: readonly TagId[] = [
  "capsule",
  "standby",
  "quiet",
  "ember",
  "fork",
  "archived",
] as const;

export interface TagLabel {
  label: string;
  explanation: string;
  /** A CSS custom property name from `src/frontend/styles/tokens.css`. */
  color: string;
}

/** 简体中文源文案 —— 同时是 msgid。渲染请用 `tagLabel()`。 */
export const TAG_LABELS: Record<TagId, TagLabel> = {
  capsule: {
    label: "时间胶囊",
    explanation:
      "最后一次推送距今已超过三年。这不代表项目已经失效，它也可能只是被好好收着。",
    color: "var(--color-gold)",
  },
  standby: {
    label: "深度待机",
    explanation: "按最后推送时间算，这个仓库有一段时间没有变化了。",
    color: "var(--color-teal)",
  },
  quiet: {
    label: "刚刚安静",
    explanation:
      "有一段时间没有推送了。这不代表它停止了维护，只说明最后推送时间在这里。",
    color: "var(--color-fg-secondary)",
  },
  ember: {
    label: "余烬未熄",
    explanation:
      "仓库安静了一段时间，但仍然有人给它点了 Star。Star 数不代表它现在仍在被使用。",
    color: "var(--color-gold)",
  },
  fork: {
    label: "远行的 Fork",
    explanation: "这是一个 Fork，出发自另一个公开项目。",
    color: "var(--color-arcane)",
  },
  archived: {
    label: "已归档",
    explanation:
      "GitHub 上这个仓库已被作者归档。这是你在 GitHub 上的状态，本站没有改动它。",
    color: "var(--color-fg-secondary)",
  },
};

export function tagLabel(id: TagId, locale: Locale = getActiveLocale()): TagLabel {
  const source = TAG_LABELS[id];
  return {
    label: t(source.label, undefined, locale),
    explanation: t(source.explanation, undefined, locale),
    color: source.color,
  };
}

/* -------------------------------------------------------------------------- */
/* 称号                                                                        */
/* -------------------------------------------------------------------------- */

export interface TitleLabel {
  name: string;
  description: string;
}

/** 简体中文源文案 —— 同时是 msgid。渲染请用 `titleLabel()`。 */
export const TITLE_LABELS: Record<TitleId, TitleLabel> = {
  "time-collector": {
    name: "时光收藏家",
    description: "有些想法，需要一点时间发酵。",
  },
  "ember-keeper": {
    name: "余烬守护者",
    description: "安静下来之后，它仍被人记得。",
  },
  "fork-voyager": {
    name: "Fork 漂流者",
    description: "有些项目出发之后，去了别的方向。",
  },
  "idea-sower": {
    name: "想法播种者",
    description: "播种很多，也留下很多。",
  },
  "light-traveler": {
    name: "轻装旅人",
    description: "你的公开仓库看起来相当轻盈。",
  },
  visitor: {
    name: "初访者",
    description: "先看看这里有什么。",
  },
};

export function titleLabel(id: TitleId, locale: Locale = getActiveLocale()): TitleLabel {
  const source = TITLE_LABELS[id];
  return {
    name: t(source.name, undefined, locale),
    description: t(source.description, undefined, locale),
  };
}

/* -------------------------------------------------------------------------- */
/* 稀有度阶梯                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The rarity grade of a repository — derived from how long it has slept.
 *
 * "越沉越稀有" — the longer it sleeps, the rarer it is. This is a fact about a duration, not a
 * verdict about a person. The tier word is always rendered, so colour is never the only carrier.
 */
export type RarityId = "common" | "rare" | "epic" | "legendary";

export const RARITY_ORDER: readonly RarityId[] = [
  "common",
  "rare",
  "epic",
  "legendary",
] as const;

export interface RarityLabel {
  label: string;
  description: string;
  /** The frame/edge token for this tier. */
  color: string;
}

/** 简体中文源文案 —— 同时是 msgid。渲染请用 `rarityLabel()`。 */
export const RARITY_LABELS: Record<RarityId, RarityLabel> = {
  common: {
    label: "普通",
    description: "还在近处，尚未走远。",
    color: "var(--rarity-common)",
  },
  rare: {
    label: "稀有",
    description: "沉睡了半年以上，安静地待着。",
    color: "var(--rarity-rare)",
  },
  epic: {
    label: "史诗",
    description: "沉睡了至少一年，这段时间没有变化。",
    color: "var(--rarity-epic)",
  },
  legendary: {
    label: "传说",
    description: "沉睡了至少三年，被好好收着。",
    color: "var(--rarity-legendary)",
  },
};

export function rarityLabel(
  id: RarityId,
  locale: Locale = getActiveLocale(),
): RarityLabel {
  const source = RARITY_LABELS[id];
  return {
    label: t(source.label, undefined, locale),
    description: t(source.description, undefined, locale),
    color: source.color,
  };
}

/* -------------------------------------------------------------------------- */
/* 灵龛充能等级                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 灵龛充能等级 —— 由「带主题的公开仓库数」派生。
 *
 * 线上**不传**这个字段：传的是数量，等级由 `src/shared/tier.ts` 里的同一个
 * 纯函数算出来，所以客户端与服务端不可能对等级有分歧。
 *
 * 等级词是罗马数字加「阶」，量级由星标承担 —— **不用金 / 银 / 铜**。
 * 金属等级的词（「铜之灵龛」）读起来像是在给用户本人定材质，而数字读起来
 * 才像是一个阶段。
 *
 * 这条阶梯量的是**用户**，稀有度阶梯量的是**仓库** —— 两条不同的轴，颜色
 * 也不共用。
 */
export type TierId = "unsealed" | "i" | "ii" | "iii" | "iv";

/** 从低到高的固定顺序。 */
export const TIER_ORDER: readonly TierId[] = [
  "unsealed",
  "i",
  "ii",
  "iii",
  "iv",
] as const;

export interface TierLabel {
  /** 等级词。未启封 / Ⅰ 阶 / Ⅱ 阶 / Ⅲ 阶 / Ⅳ 阶。 */
  label: string;
  /** 罗马数字。未启封没有数字 —— 空串。 */
  numeral: string;
  /** 阶数后缀。未启封没有后缀 —— 空串。 */
  suffix: string;
  /** 这一档在说什么。 */
  description: string;
  /** 星标数量 —— 量级的可见承载。不随语言变。 */
  stars: number;
}

/** 简体中文源文案 —— 同时是 msgid。渲染请用 `tierLabel()`。 */
export const TIER_LABELS: Record<TierId, TierLabel> = {
  unsealed: {
    label: "未启封",
    numeral: "",
    suffix: "",
    description: "还没有仓库住进来。给一个公开仓库加上主题，它就会住进来。",
    stars: 0,
  },
  i: {
    label: "Ⅰ 阶",
    numeral: "Ⅰ",
    suffix: "阶",
    description: "灵龛刚点上火。",
    stars: 1,
  },
  ii: {
    label: "Ⅱ 阶",
    numeral: "Ⅱ",
    suffix: "阶",
    description: "已经攒下一点灰烬。",
    stars: 2,
  },
  iii: {
    label: "Ⅲ 阶",
    numeral: "Ⅲ",
    suffix: "阶",
    description: "灰烬积成了堆。",
    stars: 3,
  },
  iv: {
    label: "Ⅳ 阶",
    numeral: "Ⅳ",
    suffix: "阶",
    /* 最高一档就是「装满了」的那一刻 —— 描述就是口号的后半句。 */
    description: SLOGAN_TAIL,
    stars: 4,
  },
};

export function tierLabel(id: TierId, locale: Locale = getActiveLocale()): TierLabel {
  const source = TIER_LABELS[id];
  return {
    label: t(source.label, undefined, locale),
    numeral: source.numeral,
    suffix: source.suffix === "" ? "" : t("阶", undefined, locale),
    description: t(source.description, undefined, locale),
    stars: source.stars,
  };
}

/**
 * 充能等级块本身的文案（不是某一档的）。
 *
 * 与 `TIER_LABELS` 分开，因为这些字**不属于任何一档** —— 它们是块级文案，
 * 换语言时要跟着一起换。
 */
export const TIER_COPY = {
  /** 块的标题，也是它的无障碍名称。 */
  label: "灵龛充能等级",
  /** 数量读不到时的说明。绝不说「未启封」—— 那是「0」的说法。 */
  unknown: "这次没有读到带主题的公开仓库数。",
} as const;

export function tierCopy(locale: Locale = getActiveLocale()): {
  label: string;
  unknown: string;
} {
  return {
    label: t(TIER_COPY.label, undefined, locale),
    unknown: t(TIER_COPY.unknown, undefined, locale),
  };
}

/**
 * 读屏读到的等级名称。
 *
 * 它是**真实文本**，不是裸 `<span>` 上的 `aria-label` —— 裸 span 的 role 是
 * `generic`，很多读屏直接丢掉它的可及名称（与 `UnknownValue` 同一条发现）。
 */
export function tierAccessibleName(
  tier: TierId,
  locale: Locale = getActiveLocale(),
): string {
  return `${tierCopy(locale).label} ${tierLabel(tier, locale).label}`;
}

/**
 * 等级的一行文字：「Ⅰ 阶 ★」。
 *
 * 页面、分享卡、OG 图三处都要这一行，所以它只有这一个实现。未启封没有星，
 * 星标数量就是这一档的量级；**未知返回 `null`** —— 由调用方决定写「? 未知」，
 * 绝不退化成「未启封」，那是关于零的说法。
 */
export function tierMarkText(
  tier: TierId | null,
  locale: Locale = getActiveLocale(),
): string | null {
  if (tier === null) return null;
  const label = tierLabel(tier, locale);
  const stars = "★".repeat(label.stars);
  return stars.length > 0 ? `${label.label} ${stars}` : label.label;
}

/**
 * 还差几个仓库时的那句话 —— **数字与目标档位都由文字承担**。
 *
 * 计量条量的是当前档的顶，所以剩下的距离条子说不出来；这句话补上它，
 * 而且连**升到哪一阶**一起说了。条与文字是互补的，不是重复的。
 */
export function tierNextStepCopy(
  reposLeft: number,
  nextTier: TierId,
  locale: Locale = getActiveLocale(),
): string {
  return t(
    "再收 {n} 个仓库升到 {tier}。",
    { n: reposLeft, tier: tierLabel(nextTier, locale).label },
    locale,
  );
}

/* -------------------------------------------------------------------------- */
/* 未知原因                                                                    */
/* -------------------------------------------------------------------------- */

/** 简体中文源文案 —— 同时是 msgid。渲染请用 `unknownReasonLabel()`。 */
export const UNKNOWN_REASON_LABELS: Record<UnknownReason, string> = {
  "rate-limited": "GitHub 暂时限制了请求频率，没有读到这个值。",
  timeout: "读取超时，没有读到这个值。",
  "not-provided": "GitHub 没有提供这个值。",
  unreachable: "目标暂时无法访问，没有读到这个值。",
  truncated: "这次读取被截断，没有读到这个值。",
};

export function unknownReasonLabel(
  reason: UnknownReason,
  locale: Locale = getActiveLocale(),
): string {
  return t(UNKNOWN_REASON_LABELS[reason], undefined, locale);
}

/* -------------------------------------------------------------------------- */
/* 榜单                                                                        */
/* -------------------------------------------------------------------------- */

export interface BoardLabel {
  name: string;
  description: string;
}

/** 榜单的固定顺序 —— Tab 组、路由校验、Worker 的白名单都用它。 */
export const BOARD_IDS: readonly BoardId[] = ["longest-sleep", "embers", "forks"] as const;

export function isBoardId(value: string | undefined): value is BoardId {
  return value !== undefined && (BOARD_IDS as readonly string[]).includes(value);
}

/** 简体中文源文案 —— 同时是 msgid。渲染请用 `boardLabel()`。 */
export const BOARD_LABELS: Record<BoardId, BoardLabel> = {
  "longest-sleep": {
    name: "最长沉睡榜",
    description: "它们没有走远，只是很久没有推送。",
  },
  embers: {
    name: "余烬未熄榜",
    description: "有些仓库安静了，星星还亮着。",
  },
  forks: {
    name: "Fork 漂流榜",
    description: "从别处出发，在这里继续走了一段。",
  },
};

export function boardLabel(id: BoardId, locale: Locale = getActiveLocale()): BoardLabel {
  const source = BOARD_LABELS[id];
  return {
    name: t(source.name, undefined, locale),
    description: t(source.description, undefined, locale),
  };
}

/* -------------------------------------------------------------------------- */
/* 收录状态                                                                    */
/* -------------------------------------------------------------------------- */

export interface CollectionStateLabel {
  label: string;
  /** 一句话说清它，并且**只说到有事实支撑的那一步**。 */
  description: string;
}

/**
 * 五态。`unconfirmed` 是**一等的答案** —— 它说的是「这次没能确认」，
 * 不是「没有主题」。两者的差别是用户要不要去改 GitHub 设置，
 * 所以文案在这里必须分开写，不能合成一句「未收录」。
 */
export const COLLECTION_STATE_LABELS: Record<CollectionState, CollectionStateLabel> = {
  collected: {
    label: "已入龛",
    description: "这个仓库已经在龛里了。它在哪张榜上出现，取决于沉睡时间与 Star 数。",
  },
  pending: {
    label: "待入龛",
    description: "条件都满足了，下一次收录就会把它收进来。收录每六小时跑一轮。",
  },
  "no-topic": {
    label: "还没有主题",
    description: "这个仓库没有带上本站的任何一个主题。加上主题之后，下一轮收录就会收进它。",
  },
  "not-eligible": {
    label: "不收录",
    description: "本站只收录个人账户的公开仓库。组织账户与私有仓库不在收录范围内。",
  },
  unconfirmed: {
    label: "这次没能确认",
    description:
      "没有读到确定的结果 —— 这不代表它没有主题，也不代表它不合格。稍后再查一次。",
  },
};

export function collectionStateLabel(
  state: CollectionState,
  locale: Locale = getActiveLocale(),
): CollectionStateLabel {
  const source = COLLECTION_STATE_LABELS[state];
  return {
    label: t(source.label, undefined, locale),
    description: t(source.description, undefined, locale),
  };
}

/* -------------------------------------------------------------------------- */
/* 下架工单                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 工单状态。三句话都只说**发生了什么**，不解释「为什么还没轮到」——
 * 处理时限由载荷里的 `slaHours` 说，不在这里重复。
 */
export const TAKEDOWN_STATUS_LABELS: Record<TakedownStatus, string> = {
  received: "已收到",
  actioned: "已处理",
  rejected: "未通过",
};

export function takedownStatusLabel(
  status: TakedownStatus,
  locale: Locale = getActiveLocale(),
): string {
  return t(TAKEDOWN_STATUS_LABELS[status], undefined, locale);
}

/* -------------------------------------------------------------------------- */
/* 仅客户端的错误文案（服务端永远不会下发这三条）                              */
/* -------------------------------------------------------------------------- */

export const OFFLINE_MESSAGE = "看起来你现在没有联网。连上网络后再试。";

export const CLIPBOARD_MESSAGE = "无法自动复制，请按住 Ctrl / Cmd + C 复制。";

export const CANVAS_UNAVAILABLE_NOTICE = "分享卡片暂时画不出来，结果数据还在。";

export function offlineMessage(locale: Locale = getActiveLocale()): string {
  return t(OFFLINE_MESSAGE, undefined, locale);
}

export function clipboardMessage(locale: Locale = getActiveLocale()): string {
  return t(CLIPBOARD_MESSAGE, undefined, locale);
}

export function canvasUnavailableNotice(locale: Locale = getActiveLocale()): string {
  return t(CANVAS_UNAVAILABLE_NOTICE, undefined, locale);
}
