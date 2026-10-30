import { ACHIEVEMENTS, type AchievementId } from "@/shared/achievements";
import { formatNumber } from "@/shared/format";
import { getActiveLocale, t, type Locale } from "@/shared/i18n";
import { tierLabel, type TierId } from "@/shared/ids";
import { repoTopicsLabel } from "@/shared/topic";
import { REPO_TOPICS, SITE_URL } from "./env";

/**
 * 分享文案。
 *
 * 三条硬规则：
 *
 * 1. **只陈述事实。** 等级、仓库数、徽章名 —— 不写「最懒」「失败」这类结论，
 *    也不替别人下判断。
 * 2. **不 @ 任何人。** 文案里没有 `@`，链接指向的是用户自己的页面。
 * 3. **未知不进文案。** 数量读不到时返回 `null` —— 分享面板只提供「复制链接」，
 *    而不是把「未知」写成「0 个」发出去。
 *
 * 分享永远由用户发起：这里只生成文案，真正的发布动作在 Twitter 的撰写窗口
 * 或用户自己的剪贴板里，本站不调用任何第三方写接口。
 *
 * **语言跟着分享者走。** 整句是一条 msgid（`{tier}` / `{count}` / `{topic}` 由
 * 词典决定语序），链接带 `?lang=`，打开的人看到与分享者同一语言的页面与卡片。
 */

export interface ShareContext {
  login: string;
  tier: TierId | null;
  enrolledCount: number | null;
  achievements: AchievementId[] | null;
}

/**
 * 用户页面的地址。
 *
 * 带上 `?from=share`：分享出去的链接自带标记，分享页据此把这次访问记成
 * `src=share`。微信、WhatsApp 之类会剥掉 referrer，URL 上的标记是唯一还
 * 留得住的证据。没有标记的旧链接仍可靠外站 referrer 归入分享访问。
 *
 * `lang` 与 `from` 并列，而不是覆盖它 —— 两个参数各说一件事：来路，与语言。
 */
export function profileUrl(login: string, locale: Locale = getActiveLocale()): string {
  const params = new URLSearchParams({ from: "share", lang: locale });
  return `${SITE_URL}/u/${encodeURIComponent(login)}?${params.toString()}`;
}

/**
 * 站点主机名 —— 分享卡的页脚写它。
 *
 * 拿不到（没有 `window`、地址不合法）时返回 `null`：页脚少一行是小事，
 * 在图上印一个空串或一个假域名不是。
 */
export function profileHost(): string | null {
  if (SITE_URL.length === 0) return null;
  try {
    return new URL(SITE_URL).host || null;
  } catch {
    return null;
  }
}

/**
 * 名字列表的连接符。
 *
 * 中文与日文用顿号，英语用逗号加空格 —— 这是拼接规则，不是文案，
 * 所以它留在代码里，而不是让每种语言的译文各自背一个分隔符。
 */
function joinNames(names: string[], locale: Locale): string {
  return names.join(locale === "en" ? ", " : "、");
}

export function buildShareText(
  ctx: ShareContext,
  locale: Locale = getActiveLocale(),
): string | null {
  if (ctx.enrolledCount === null || ctx.tier === null) return null;

  /* 量词在句子里（`{count} 个公开仓库` 是一条整句），所以这里只放数字；
     数字本身仍按语言分组，`4,967` 与 `4 967` 各按各的写法。 */
  const count = formatNumber(ctx.enrolledCount, locale);
  if (count === null) return null;

  const lines = [
    t(
      "我在码之灵龛（Repo Vessel）点亮了 {tier}：{count} 个公开仓库带着 {topic} 主题。",
      {
        tier: tierLabel(ctx.tier, locale).label,
        count,
        topic: repoTopicsLabel(REPO_TOPICS, locale),
      },
      locale,
    ),
  ];

  const names = (ctx.achievements ?? [])
    .map((id) => ACHIEVEMENTS.find((def) => def.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length > 0) {
    lines.push(t("拿到的徽章：{names}。", { names: joinNames(names, locale) }, locale));
  }

  lines.push(profileUrl(ctx.login, locale));
  return lines.join("\n");
}

/** Twitter / X 的撰写窗口。用户在窗口里确认后才发布。 */
export function twitterIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
