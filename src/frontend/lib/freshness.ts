/**
 * 新鲜度 —— §5.4「时间戳与陈旧度」。
 *
 * 陈旧不是错误：数据仍然真实，只是可能已经过时。所以这一层只回答两个问题：
 * 这份数据有多旧？它是不是旧到需要说一声？
 *
 * 阈值来自 `THRESHOLDS.staleAfterHours`，和界面上公开的说明是同一个数。
 * 读不到时间戳时返回 `null` —— **未知不等于新鲜**，也不等于陈旧。
 */

import { formatDuration } from "@/shared/format";
import { getActiveLocale, type Locale } from "@/shared/i18n";
import { THRESHOLDS } from "@/shared/thresholds";

const HOUR_MS = 3_600_000;
const HOURS_PER_DAY = 24;

/** 数据年龄（小时）。时间戳读不到时返回 `null`。 */
export function ageHours(readAt: string | null, now: number = Date.now()): number | null {
  if (readAt === null) return null;
  const t = Date.parse(readAt);
  if (Number.isNaN(t)) return null;
  return (now - t) / HOUR_MS;
}

/**
 * 陈旧判定。读取时间超过 24 小时就是陈旧。
 *
 * 时间戳在将来（时钟漂移、接口给错）不算陈旧 —— 那不是「旧」，那是读不出来。
 */
export function isStale(readAt: string | null, now: number = Date.now()): boolean {
  const age = ageHours(readAt, now);
  if (age === null) return false;
  return age > THRESHOLDS.staleAfterHours;
}

/**
 * 陈旧时长，例如「3 天」。数据还不陈旧时返回 `null`。
 *
 * 只有在陈旧时才会被用到，所以它至少跨过了一整天；跨天数时向上取整，
 * 免得「1 天」听起来比实际更旧。调用方自己决定怎么接：「这是 3 天前的数据」。
 */
export function staleAgeLabel(
  readAt: string | null,
  now: number = Date.now(),
  locale: Locale = getActiveLocale(),
): string | null {
  const age = ageHours(readAt, now);
  if (age === null || age <= THRESHOLDS.staleAfterHours) return null;
  const days = Math.ceil(age / HOURS_PER_DAY);
  /* 单位与 `formatDuration` 是同一份规则 —— 页面上「2 天」与「2 days」不能
     一个走这里、一个走那里。 */
  return formatDuration(days, locale);
}
