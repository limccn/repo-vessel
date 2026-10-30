/**
 * 国际化核心 —— 语言模型、检测、协商与查表。
 *
 * **中文原文就是 msgid。** 站点原本用简体中文写成，所有用户可见的句子都已经
 * 在代码里。把每条再改写成一个人造键名、再把中文抄一遍，只会多一次漂移的机会；
 * 所以词典的键是**简体中文原句**，`zh-Hans` 直接返回键本身，`en` / `zh-Hant` /
 * `ja` 三张表只负责翻译。缺译时回落到中文原句 —— 看得见，不是空白，也不是崩溃。
 *
 * 占位符写成 `{name}`，由 `t()` 替换。整句翻译，不拆 JSX 片段：需要内联加粗或
 * 内联组件时用 `Trans`（`src/frontend/i18n/Trans.tsx`），把整句和节点一起交给它。
 */

import { EN, JA, ZH_HANT } from "./i18n-dictionaries";

export type Locale = "zh-Hans" | "zh-Hant" | "en" | "ja";

/** 全部语言。默认语言排在最前 —— 分段控件也用这个顺序。 */
export const LOCALES: readonly Locale[] = ["en", "zh-Hans", "zh-Hant", "ja"] as const;

/** 没有匹配时使用的语言。英语是产品的默认语言。 */
export const DEFAULT_LOCALE: Locale = "en";

/** 写进 `localStorage` 的键。 */
export const LOCALE_STORAGE_KEY = "rv_locale";

/** `Intl` 用的 BCP 47 标签。 */
export const LOCALE_TAGS: Record<Locale, string> = {
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  en: "en",
  ja: "ja",
};

/** Open Graph 的 `og:locale`。 */
export const OG_LOCALES: Record<Locale, string> = {
  "zh-Hans": "zh_CN",
  "zh-Hant": "zh_TW",
  en: "en_US",
  ja: "ja_JP",
};

/** 每种语言自己的名字 —— 给 `aria-label` 与 `title` 用，不随界面语言变。 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ja: "日本語",
};

/**
 * 登录用户可选的**语言偏好**：中文是一个选项，简／繁由浏览器地区决定。
 *
 * 偏好与 `Locale` 是两层。`Locale` 是这一页到底用哪种文字；偏好是用户说
 * 「我要中文」—— 他用繁体地区的浏览器就给他繁体，用简体地区的就给他简体，
 * 他不需要知道 `zh-Hans` / `zh-Hant` 这两个标签存在。
 */
export type LocalePreference = "en" | "zh" | "ja";

export const LOCALE_PREFERENCES: readonly LocalePreference[] = [
  "en",
  "zh",
  "ja",
] as const;

/** 偏好控件上的标签 —— 用每种语言自己的写法，不随界面语言翻译。 */
export const LOCALE_PREFERENCE_LABELS: Record<LocalePreference, string> = {
  en: "ENGLISH",
  zh: "中文",
  ja: "日本語",
};

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  en: EN,
  "zh-Hans": {},
  "zh-Hant": ZH_HANT,
  ja: JA,
};

export function isLocale(value: unknown): value is Locale {
  return (
    value === "zh-Hans" || value === "zh-Hant" || value === "en" || value === "ja"
  );
}

/**
 * 把一个语言标签归一到四种语言之一。
 *
 * 只看语言与书写系统，不看地区：`zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant`
 * 都是繁体；其余 `zh` 是简体；`ja` 是日语；`en` 是英语。返回 `null` 表示
 * 这个标签不在目标语言里 —— 由调用方决定回落到什么。
 */
export function localeFromLanguage(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const normalized = tag.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "") return null;

  if (normalized === "zh-hant" || normalized.startsWith("zh-hant-")) return "zh-Hant";
  if (normalized === "zh" || normalized.startsWith("zh-")) {
    const region = normalized.split("-")[1] ?? "";
    return region === "tw" || region === "hk" || region === "mo" ? "zh-Hant" : "zh-Hans";
  }
  if (normalized === "ja" || normalized.startsWith("ja-")) return "ja";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

/** 一个可能已经是 `Locale`、也可能是 `zh-CN` 之类的值。 */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (isLocale(value)) return value;
  return localeFromLanguage(value);
}

function readStoredLocale(): Locale | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return normalizeLocale(globalThis.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    /* 隐私模式 / 禁用存储：当作没有保存过。 */
    return null;
  }
}

/**
 * 浏览器语言列表 → 第一种能识别的语言。
 *
 * 顺序是浏览器自己给的偏好顺序；`zh-CN, en-US` 里第一种能识别的是简体，
 * 就选简体 —— 这不是「英语优先」，而是尊重浏览器已经排好的顺序。
 */
export function localeFromLanguages(
  languages: readonly string[] | null | undefined,
): Locale | null {
  if (!languages) return null;
  for (const language of languages) {
    const matched = localeFromLanguage(language);
    if (matched) return matched;
  }
  return null;
}

export function isLocalePreference(value: unknown): value is LocalePreference {
  return value === "en" || value === "zh" || value === "ja";
}

/**
 * 偏好 → 这一页用哪种文字。
 *
 * 只有 `zh` 需要判断：先在浏览器语言里找中文标签，找到就按它的地区取简／繁
 * （`zh-TW` / `zh-HK` / `zh-MO` / `zh-Hant*` 是繁体，其余 `zh` 是简体）；
 * 列表里根本没有中文时用简体 —— 那是中文用户的最大公约数。`en` / `ja` 原样返回。
 */
export function resolveLocalePreference(
  preference: LocalePreference,
  languages: readonly string[] | null | undefined = null,
): Locale {
  if (preference !== "zh") return preference;
  const chinese = (languages ?? []).find((tag) => tag.trim().toLowerCase().startsWith("zh"));
  if (!chinese) return "zh-Hans";
  return localeFromLanguage(chinese) ?? "zh-Hans";
}

/** 当前文字 → 偏好。简体与繁体都记作 `zh`。 */
export function preferenceForLocale(locale: Locale): LocalePreference {
  return locale === "en" || locale === "ja" ? locale : "zh";
}

/**
 * 首次进入时的语言。
 *
 * 顺序固定：URL `?lang=` → 本地保存的选择 → `navigator.languages` → 英语。
 * URL 最优先，因为分享链接必须带着分享者的语言；保存的选择次之，因为那是
 * 用户自己按过的按钮；浏览器语言只是在没有前两者时的自动判断。
 */
export function detectLocale(
  options: {
    search?: string;
    stored?: string | null;
    languages?: readonly string[] | null;
  } = {},
): Locale {
  const search =
    options.search ??
    (typeof globalThis.location !== "undefined" ? globalThis.location.search : "");
  const fromUrl = normalizeLocale(new URLSearchParams(search).get("lang"));
  if (fromUrl) return fromUrl;

  const stored =
    options.stored !== undefined ? normalizeLocale(options.stored) : readStoredLocale();
  if (stored) return stored;

  const languages =
    options.languages ??
    (typeof navigator !== "undefined"
      ? (navigator.languages ?? [navigator.language])
      : null);
  return localeFromLanguages(languages) ?? DEFAULT_LOCALE;
}

/**
 * `Accept-Language` → 语言。
 *
 * 只做最低限度的事：按 `q` 从高到低排，取第一个能识别的标签。没有 q 的项
 * 按 1 处理；`*` 跳过。复杂到需要完整 RFC 4647 匹配时再说。
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;
  const entries = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const quality = q === undefined ? 1 : Number.parseFloat(q.slice(2));
      return { tag: tag ?? "", q: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag !== "" && entry.tag !== "*" && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    const matched = localeFromLanguage(entry.tag);
    if (matched) return matched;
  }
  return null;
}

/**
 * 一次请求的语言。
 *
 * 分享路由用 `?lang=`；SPA 的 `/api/*` 请求带 `x-rv-locale`；直接调用 API 的
 * 客户端用 `Accept-Language`。三层都没有就是英语。
 */
export function localeFromRequest(request: Request): Locale {
  const url = new URL(request.url);
  const fromQuery = normalizeLocale(url.searchParams.get("lang"));
  if (fromQuery) return fromQuery;

  const fromHeader = normalizeLocale(request.headers.get("x-rv-locale"));
  if (fromHeader) return fromHeader;

  return negotiateLocale(request.headers.get("accept-language")) ?? DEFAULT_LOCALE;
}

/** 模块级的当前语言 —— 让不经过 React 的 `api/client.ts` 也能读到。 */
let activeLocale: Locale = DEFAULT_LOCALE;

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function setActiveLocale(locale: Locale): void {
  if (isLocale(locale)) activeLocale = locale;
}

export type Vars = Record<string, string | number>;

/**
 * 查表 + 插值。
 *
 * 缺译回落到 msgid（简体中文原句）—— 这是唯一允许的回落方向。英语用户看到
 * 一句中文，是「这里还没翻」，不是「这里没有内容」；反过来把中文用户回落到
 * 英语才是错的。
 */
export function t(msgid: string, vars?: Vars, locale: Locale = activeLocale): string {
  const dictionary = DICTIONARIES[locale] ?? {};
  const template = locale === "zh-Hans" ? msgid : (dictionary[msgid] ?? msgid);
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  );
}

/** 某语言是否覆盖了这条文案。审计脚本与测试用得到。 */
export function hasTranslation(msgid: string, locale: Locale): boolean {
  if (locale === "zh-Hans") return true;
  return Object.prototype.hasOwnProperty.call(DICTIONARIES[locale], msgid);
}
