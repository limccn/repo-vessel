/**
 * 展示层的格式化 —— 每一条都按当前语言取数字与时间的写法。
 *
 * 这里的每一条都遵守同一条规则：读不到的值返回 `null`，由调用方渲染
 * 「? 未知」。任何函数都不允许把未知变成 0、空串或「—」。
 *
 * 默认语言是 `getActiveLocale()`：DOM 里由 `LocaleProvider` 设置，
 * Worker 里由每个请求显式传入 —— 服务端不依赖模块状态。
 */

import { LOCALE_TAGS, getActiveLocale, type Locale } from "./i18n";

const NUMBER_FORMATS = new Map<Locale, Intl.NumberFormat>();

function numberFormat(locale: Locale): Intl.NumberFormat {
  let format = NUMBER_FORMATS.get(locale);
  if (format === undefined) {
    format = new Intl.NumberFormat(LOCALE_TAGS[locale]);
    NUMBER_FORMATS.set(locale, format);
  }
  return format;
}

export function formatNumber(
  value: number | null,
  locale: Locale = getActiveLocale(),
): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return numberFormat(locale).format(value);
}

function dayUnit(days: number, locale: Locale): string {
  switch (locale) {
    case "en":
      return days === 1 ? "day" : "days";
    case "ja":
      return "日";
    default:
      return "天";
  }
}

/** 沉睡天数。带单位。 */
export function formatDuration(
  days: number | null,
  locale: Locale = getActiveLocale(),
): string | null {
  if (days === null || !Number.isFinite(days)) return null;
  return `${numberFormat(locale).format(days)} ${dayUnit(days, locale)}`;
}

/**
 * 计数的量词 —— 「12 个」。
 *
 * 英语不需要量词（`12` 本身就是全部），中日文需要。量词不是文案，
 * 是语法的一部分，所以它留在代码里，跟着 `formatDuration` 的单位走。
 */
export function formatCount(
  value: number | null,
  locale: Locale = getActiveLocale(),
): string | null {
  const n = formatNumber(value, locale);
  if (n === null) return null;
  switch (locale) {
    case "en":
      return n;
    case "ja":
    case "zh-Hant":
      return `${n} 個`;
    default:
      return `${n} 个`;
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function minutesAgo(minutes: number, locale: Locale): string {
  switch (locale) {
    case "en":
      return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
    case "ja":
      return `${minutes} 分前`;
    case "zh-Hant":
      return `${minutes} 分鐘前`;
    default:
      return `${minutes} 分钟前`;
  }
}

function hoursAgo(hours: number, locale: Locale): string {
  switch (locale) {
    case "en":
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    case "ja":
      return `${hours} 時間前`;
    case "zh-Hant":
      return `${hours} 小時前`;
    default:
      return `${hours} 小时前`;
  }
}

function daysAgo(days: number, locale: Locale): string {
  switch (locale) {
    case "en":
      return days === 1 ? "1 day ago" : `${days} days ago`;
    case "ja":
      return `${days} 日前`;
    case "zh-Hant":
      return `${days} 天前`;
    default:
      return `${days} 天前`;
  }
}

function justNow(locale: Locale): string {
  switch (locale) {
    case "en":
      return "just now";
    case "ja":
      return "たった今";
    case "zh-Hant":
      return "剛剛";
    default:
      return "刚刚";
  }
}

export function formatRelativeTime(
  iso: string | null,
  locale: Locale = getActiveLocale(),
  now: number = Date.now(),
): string | null {
  if (iso === null) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  const delta = now - parsed;
  if (delta < MINUTE) return justNow(locale);
  if (delta < HOUR) return minutesAgo(Math.floor(delta / MINUTE), locale);
  if (delta < DAY) return hoursAgo(Math.floor(delta / HOUR), locale);
  if (delta < 30 * DAY) return daysAgo(Math.floor(delta / DAY), locale);
  return formatDateTime(iso, locale);
}

const DATE_TIME_PARTS = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * `YYYY-MM-DD HH:mm` —— 一个**与语言无关**的绝对时间。
 *
 * 绝对时间不翻译：`2026-11-01 12:00` 在四种语言里读起来是同一刻。用 `en-CA`
 * 取零件再手工拼，是为了拿到稳定的五位/四位序，而不是让 `Intl` 按语言重排
 * （日语的「2026年11月1日 12:00」在等宽字体里会跳动）。时区沿用运行环境。
 */
export function formatDateTime(
  iso: string | null,
  locale: Locale = getActiveLocale(),
): string | null {
  void locale;
  if (iso === null) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  const parts = DATE_TIME_PARTS.formatToParts(new Date(parsed));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** 过了多久 —— 「这是 3 天前的数据」。 */
export function formatAgo(
  iso: string | null,
  locale: Locale = getActiveLocale(),
  now: number = Date.now(),
): string | null {
  if (iso === null) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  const delta = now - parsed;
  if (delta < HOUR) {
    switch (locale) {
      case "en":
        return "less than 1 hour";
      case "ja":
        return "1 時間未満";
      case "zh-Hant":
        return "不到 1 小時";
      default:
        return "不到 1 小时";
    }
  }
  if (delta < DAY) return hoursAgo(Math.floor(delta / HOUR), locale).replace(/ ago$/, "").replace(/前$/, "").trim();
  return daysAgo(Math.floor(delta / DAY), locale).replace(/ ago$/, "").replace(/前$/, "").trim();
}

/** 语言名。GitHub 的 language 字段是英文的，展示时保持原样。 */
export function formatLanguage(language: string | null): string | null {
  if (language === null) return null;
  const trimmed = language.trim();
  return trimmed.length > 0 ? trimmed : null;
}
