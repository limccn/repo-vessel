/**
 * OG 预览卡的 SVG。
 *
 * 纯函数：给一组事实，返回一段 SVG 字符串。不读时钟、不读 DOM、不发请求 ——
 * 所以「未知写成什么」这件事可以在单测里逐条钉住。
 *
 * 这里**没有一句文案是现拼的**：标签来自 `siteCopy(locale).shareCard` 与
 * `tierCopy(locale)`，称号名来自 `titleLabel(id, locale)`，数字走的是页面同一个
 * 格式化函数（`src/shared/format.ts`，同样按语言取单位与量词）。卡片与页面对
 * 同一件事说同一句话，是这张图能被信任的唯一理由。
 *
 * 颜色来自 `src/shared/tokens.generated.ts` —— `tokens.css` 的只读镜像。SVG 里
 * 写 `var(--color-gold)` 没有意义（resvg 不解析 CSS 变量），所以只能是真值；
 * 但真值仍然只有一个手写的源头。
 */

import { siteCopy } from "@/shared/copy";
import { formatCount, formatDateTime, formatDuration } from "@/shared/format";
import { DEFAULT_LOCALE, type Locale } from "@/shared/i18n";
import { tierCopy, tierMarkText, titleLabel, type TitleId, type TierId } from "@/shared/ids";
import { COLOR_TOKENS } from "@/shared/tokens.generated";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/**
 * 子集字体的族名。resvg 不读系统字体（Worker 里也没有），所以这个字符串是
 * **唯一**能把 SVG 的 `font-family` 与 `og-font.<locale>.ttf` 连起来的东西 —— 字体子集
 * 换了族名而这里没改，图上的字会全部消失，而不是报错。
 *
 * 每个语言一份字体（简体 / 繁体 / 日语），所以族名也是**按语言**取的：
 * `og-font.<locale>.ttf` 里的族名必须与 `ogFontFamily(locale)` 完全一致。
 * 两个字重各是一份静态子集，所以这里的 `font-weight="700"` 是真会变粗的；
 * 可变字体在这里没有用，见 `render.ts`。
 */
const OG_FONT_FAMILIES: Record<Locale, string> = {
  "zh-Hans": "Noto Sans SC",
  en: "Noto Sans SC",
  "zh-Hant": "Noto Sans TC",
  ja: "Noto Sans JP",
};

export function ogFontFamily(locale: Locale = DEFAULT_LOCALE): string {
  return OG_FONT_FAMILIES[locale];
}

export interface OgCardFacts {
  login: string;
  /** `null` = 没读到（账户不存在 / 组织 / 限流）。称号是派生值，同样不能猜。 */
  titleId: TitleId | null;
  tier: TierId | null;
  enrolledCount: number | null;
  longestDormantDays: number | null;
  readAt: string | null;
  /** 卡片页脚的域名。没有就少画一行，不印假域名。 */
  host: string | null;
}

/** XML 转义。用户数据只有用户名与域名，但它们是唯二从 URL 进来的东西。 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface Line {
  text: string;
  unknown: boolean;
}

function line(value: string | null, fallback: string): Line {
  return value === null ? { text: fallback, unknown: true } : { text: value, unknown: false };
}

export function buildOgCard(
  facts: OgCardFacts,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const copy = siteCopy(locale);
  const labels = copy.shareCard;
  const tierLabels = tierCopy(locale);
  const unknownColor = COLOR_TOKENS["state-unknown"];
  const valueColor = COLOR_TOKENS["data-emphasis"];

  const rows: Line[] = [
    line(tierMarkText(facts.tier, locale), labels.unknown),
    line(formatDuration(facts.longestDormantDays, locale), labels.unknown),
    line(formatCount(facts.enrolledCount, locale), labels.unknown),
  ];
  const rowLabels = [tierLabels.label, labels.longestDormant, labels.enrolled];

  const stamp = formatDateTime(facts.readAt, locale);
  const day = stamp === null ? null : stamp.slice(0, 10);
  const readAtText = day === null ? labels.unknown : `${labels.readAt} ${day}`;

  const titleName =
    facts.titleId === null ? labels.unknown : titleLabel(facts.titleId, locale).name;
  const titleColor = facts.titleId === null ? unknownColor : COLOR_TOKENS["fg-primary"];
  const siteName = copy.siteNameLatin
    ? `${copy.siteName} · ${copy.siteNameLatin}`
    : copy.siteName;

  /* 右列三行：标签在上、值在下，右对齐。y 从 130 起，每行 130。 */
  const rightColumn = rowLabels
    .map((label, index) => {
      const top = 150 + index * 130;
      const color = rows[index]?.unknown ? unknownColor : valueColor;
      return [
        `<text x="1120" y="${top}" font-size="26" text-anchor="end" fill="${COLOR_TOKENS["fg-muted"]}">${escapeXml(label)}</text>`,
        `<text x="1120" y="${top + 48}" font-size="38" text-anchor="end" fill="${color}">${escapeXml(rows[index]?.text ?? "")}</text>`,
      ].join("\n  ");
    })
    .join("\n  ");

  const host = facts.host === null ? "" : escapeXml(facts.host);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" font-family="'${ogFontFamily(locale)}', sans-serif">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLOR_TOKENS["bg-base"]}"/>
  <rect x="32" y="32" width="${OG_WIDTH - 64}" height="${OG_HEIGHT - 64}" fill="none" stroke="${COLOR_TOKENS.gold}" stroke-opacity="0.42" stroke-width="2"/>
  <text x="80" y="120" font-size="28" fill="${COLOR_TOKENS["fg-muted"]}">${escapeXml(siteName)}</text>
  ${rightColumn}
  <text x="80" y="${OG_HEIGHT / 2 + 10}" font-size="84" font-weight="700" fill="${titleColor}">${escapeXml(titleName)}</text>
  <text x="80" y="${OG_HEIGHT / 2 + 92}" font-size="52" fill="${COLOR_TOKENS.gold}">${escapeXml(`@${facts.login}`)}</text>
  <line x1="80" y1="${OG_HEIGHT - 110}" x2="${OG_WIDTH - 80}" y2="${OG_HEIGHT - 110}" stroke="${COLOR_TOKENS["fg-primary"]}" stroke-opacity="0.1" stroke-width="1"/>
  <text x="80" y="${OG_HEIGHT - 62}" font-size="24" fill="${COLOR_TOKENS["fg-muted"]}">${escapeXml(readAtText)}</text>
  <text x="${OG_WIDTH - 80}" y="${OG_HEIGHT - 62}" font-size="24" text-anchor="end" fill="${COLOR_TOKENS["fg-muted"]}">${host}</text>
</svg>`;
}
