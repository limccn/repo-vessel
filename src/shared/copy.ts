/**
 * 站点框架文案 —— 每一句都在 `src/shared/i18n-dictionaries.ts` 里有一份翻译。
 *
 * 这里放的是**站点框架**：每一个页面都会出现、换语言时必须一起换的那些字。
 * 按 id 索引的文案（`TAG_LABELS` / `TITLE_LABELS` / `RARITY_LABELS` /
 * `BOARD_LABELS` / `TIER_LABELS`）留在 `src/shared/ids.ts`；本文件只负责
 * 把它们组装成一套 `SiteCopy`。
 *
 * **中文原文就是 msgid。** `siteCopy(locale)` 逐字段调用 `t()`，所以这里没有
 * 第二份英文/日文/繁体；词典是唯一的数据源，缺译时回落成中文原句。
 */

import { DEFAULT_LOCALE, LOCALES, type Locale, getActiveLocale, t } from "./i18n";

export { LOCALES, type Locale };

/**
 * 口号的前半句 —— 比喻。
 *
 * 它说的是一个**比喻**，不是任何一个仓库或开发者的结论，所以不违反
 * 「不下结论」这条产品边界。它也只出现在落地页的品牌位，从不出现在卡片、
 * 榜单行或报告里 —— 那些地方一个事实性的读法是成立的。
 */
export const SLOGAN_HEAD = "当一个项目在战场上倒下，它的灰烬便会归于此龛。";

/**
 * 口号的后半句 —— 同时也是最高阶（Ⅳ 阶）的描述。
 *
 * 同一句话在这里出现两次是故意的：灵龛装满的那一刻就是它变成容器的那一刻，
 * 所以最高一档的描述就是口号的后半句。**只存这一份。**
 */
export const SLOGAN_TAIL = "充能完毕，随时准备为下一个项目注入生命。";

export function sloganHead(locale: Locale = getActiveLocale()): string {
  return t(SLOGAN_HEAD, undefined, locale);
}

export function sloganTail(locale: Locale = getActiveLocale()): string {
  return t(SLOGAN_TAIL, undefined, locale);
}

/**
 * 完整口号。落地页的品牌位。
 *
 * 英文两句之间要一个空格，中日文不需要 —— 这是拼接规则，不是翻译内容，
 * 所以它留在代码里，而不是再抄一条「整句口号」的 msgid。
 */
export function slogan(locale: Locale = getActiveLocale()): string {
  const gap = locale === "en" ? " " : "";
  return `${sloganHead(locale)}${gap}${sloganTail(locale)}`;
}

export interface SiteCopy {
  /** 站名，随界面语言变。 */
  siteName: string;
  /** 拉丁字母站名。英语界面下与 `siteName` 相同，所以留空。 */
  siteNameLatin: string;
  /** 品牌口号。 */
  slogan: string;
  meta: {
    /** 浏览器标题。 */
    title: string;
    /** 搜索结果描述。 */
    description: string;
    /** 社交卡片描述。 */
    ogDescription: string;
  };
  nav: {
    /** 首页入口。 */
    inspect: string;
    /** 榜单。 */
    boards: string;
    /** 如何入龛。 */
    how: string;
    /** 登录按钮。 */
    signIn: string;
  };
  footer: {
    /** 产品边界声明。 */
    boundary: string;
    links: {
      how: string;
      boards: string;
      takedown: string;
      /** 维护者的 Twitter / X。 */
      twitter: string;
      /** 本项目的 GitHub 仓库。 */
      github: string;
    };
  };
  /** 无 JavaScript 时的兜底说明。 */
  noscript: string;
  /**
   * 分享卡上的行标签。
   *
   * 客户端画布（`src/frontend/lib/shareCard.ts`）与 Worker 的 OG 图
   * （`src/worker/share/`）画的是同一件事，标签只能有一份。
   *
   * 等级那一行的标签**不在这里**：它是 `tierCopy().label`（`src/shared/ids.ts`），
   * 与鉴定页上的那一块同名 —— 同一个概念不该有两张表。
   */
  shareCard: {
    /** 带主题的公开仓库数。 */
    enrolled: string;
    /** 最长沉睡天数。 */
    longestDormant: string;
    /** 读取时间的行首。 */
    readAt: string;
    /** 读不到的值。卡片上不区分原因，只表示「没有读到」。 */
    unknown: string;
  };
}

/**
 * 取一套文案。
 *
 * 语言没有对应文案时回落到英语 —— 英语是产品的默认语言与兜底语言。
 * 单条缺译则在 `t()` 里回落到中文原句；那是「这里还没翻」，不是「这里没有内容」。
 */
export function siteCopy(locale: Locale = getActiveLocale()): SiteCopy {
  const l = locale ?? DEFAULT_LOCALE;
  const siteName = t("码之灵龛", undefined, l);
  return {
    siteName,
    siteNameLatin: l === "en" ? "" : "Repo Vessel",
    slogan: slogan(l),
    meta: {
      title: t("码之灵龛 · Repo Vessel", undefined, l),
      description: t(
        "输入一个 GitHub 用户名，看看你的公开仓库里哪些还在沉睡、哪些 Fork 漂泊去了哪里。",
        undefined,
        l,
      ),
      ogDescription: t("灵龛鉴定 · 沉睡仓库图鉴 · 时光收藏家", undefined, l),
    },
    nav: {
      inspect: t("查查我的灵龛", undefined, l),
      boards: t("围观榜单", undefined, l),
      how: t("如何入龛", undefined, l),
      signIn: t("GitHub 登录", undefined, l),
    },
    footer: {
      boundary: t(
        "本站只读取公开仓库的元数据，从不归档、删除、同步、改名或修改任何仓库，也不保存仓库里的任何代码。仓库带上本站的主题即可被收录；仓库主人认领之后，可以把它从榜单上隐藏。",
        undefined,
        l,
      ),
      links: {
        how: t("如何入龛", undefined, l),
        boards: t("榜单", undefined, l),
        takedown: t("下架申请", undefined, l),
        twitter: t("Twitter / X", undefined, l),
        github: t("GitHub 仓库", undefined, l),
      },
    },
    noscript: t(
      "码之灵龛需要 JavaScript 才能运行。没有它，你仍然可以直接访问公开仓库页面。",
      undefined,
      l,
    ),
    shareCard: {
      enrolled: t("带主题仓库", undefined, l),
      longestDormant: t("最长沉睡", undefined, l),
      readAt: t("读取于", undefined, l),
      unknown: t("? 未知", undefined, l),
    },
  };
}
