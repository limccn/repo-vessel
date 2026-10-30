/**
 * 灵龛鉴定卡 —— 客户端画布。
 *
 * 三层，分开是因为它们的可测性完全不同：
 *
 * | 层 | 碰什么 | 在哪测 |
 * |---|---|---|
 * | `buildShareCardModel` | 只碰数据 | jsdom，纯函数 |
 * | `readCardPalette` | 只碰 CSS 变量 | —— |
 * | `paintShareCard` | 只碰 `CanvasRenderingContext2D` | —— |
 *
 * 规则与页面上完全一致，只是这里没有 DOM 可以承载它们：
 *
 * 1. **未知不是零。** 读不到的数是 `? 未知`，不是 `0 个`。分支全在 `buildShareCardModel`
 *    里，所以这张图不可能是「未知写成 0」的图。
 * 2. **颜色从令牌读。** 画布上来不得半点和 `tokens.css` 不一致的色值 —— 所有颜色都经
 *    `readCardPalette()` 从 CSS 自定义属性取，读不全就当作画布不可用。`npm run
 *    audit:design` 的「令牌文件之外没有色值」这条规则因此对画布同样成立。
 * 3. **只有事实。** 用户名、称号、两个数、时间、域名。没有评价词，没有别人。
 */

import { siteCopy } from "@/shared/copy";
import { formatDateTime, formatDuration, formatCount } from "@/shared/format";
import { getActiveLocale, type Locale } from "@/shared/i18n";
import { tierCopy, tierMarkText, type TierId } from "@/shared/ids";

/** 卡片的成品尺寸。竖版，朋友圈与 X 都放得下。 */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1440;

export interface ShareCardInput {
  login: string;
  /** 称号名（调用方已本地化，来自 `titleLabel(id, locale).name`）。 */
  titleName: string;
  /** 由 `enrolledCount` 派生；未知时是 `null`。 */
  tier: TierId | null;
  enrolledCount: number | null;
  longestDormantDays: number | null;
  /** 这一次读取的时刻（`readAt`）。 */
  readAt: string;
}

export interface ShareCardRow {
  label: string;
  value: string;
  /**
   * 这一行的值是「没读到」而不是一个数字。
   *
   * 页面上未知值是灰的、带虚线下划线；图上没有下划线，只能靠颜色与 `?` 号区分 ——
   * 而颜色必须一致，否则同一屏上的两套系统对「未知」各说各的。
   */
  unknown: boolean;
}

export interface ShareCardModel {
  /** 站名，拉丁名跟在后面。 */
  siteName: string;
  login: string;
  titleName: string;
  rows: ShareCardRow[];
  /** 「读取于 2026-11-01」。 */
  readAtValue: string;
  /** 页脚的主机名。 */
  host: string;
}

/**
 * 数据 → 卡片上要写的字。
 *
 * 这是唯一决定「未知怎么写」的地方。纯函数，不读 DOM、不读时钟。
 *
 * 语言由调用方显式传入（与 `src/shared/format.ts` 的每个函数同一规则）；
 * 没有调用方时读模块级当前语言。所有文案仍然只从 `siteCopy` / `tierCopy`
 * 来 —— 图上与页面上说的是同一句话。
 */
export function buildShareCardModel(
  input: ShareCardInput,
  locale: Locale = getActiveLocale(),
  host: string | null = null,
): ShareCardModel {
  const copy = siteCopy(locale);
  const labels = copy.shareCard;
  /* 星标是量级的可见承载，页面上和图上都得有 —— 只有字、没有星，图上就少一档信息。 */
  const tierValue = tierMarkText(input.tier, locale);

  /* 「个」是量词，跟着语言走：英语 `12`、中日文 `12 个 / 12 個`。 */
  const countValue = formatCount(input.enrolledCount, locale);
  const dormantValue = formatDuration(input.longestDormantDays, locale);

  /* 读取时间读不到时也是未知 —— 一张说不出「数据截至何时」的图，违反的是同一条规则。 */
  const stamp = formatDateTime(input.readAt, locale);
  const day = stamp === null ? null : stamp.slice(0, 10);

  const row = (label: string, value: string | null): ShareCardRow => ({
    label,
    value: value ?? labels.unknown,
    unknown: value === null,
  });

  return {
    /* 英语界面下 `siteNameLatin` 是空串 —— 拉丁名与站名相同，不重复写两遍，
       也不留一个孤零零的「 · 」。 */
    siteName: copy.siteNameLatin
      ? `${copy.siteName} · ${copy.siteNameLatin}`
      : copy.siteName,
    login: `@${input.login}`,
    titleName: input.titleName,
    rows: [
      row(tierCopy(locale).label, tierValue),
      row(labels.longestDormant, dormantValue),
      row(labels.enrolled, countValue),
    ],
    readAtValue: day === null ? labels.unknown : `${labels.readAt} ${day}`,
    host: host ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/* 调色板                                                                      */
/* -------------------------------------------------------------------------- */

export interface CardPalette {
  background: string;
  border: string;
  siteName: string;
  title: string;
  login: string;
  label: string;
  value: string;
  /** 「没读到」的值的颜色，与页面上的 `? 未知` 同一个令牌。 */
  unknown: string;
  footer: string;
  rule: string;
}

/** 卡片用到的令牌。名字就是 `tokens.css` 里的变量名，不多写一层映射表。 */
const PALETTE_TOKENS = {
  background: "--color-bg-base",
  border: "--color-gold-soft",
  siteName: "--color-fg-muted",
  title: "--color-fg-primary",
  login: "--color-gold",
  label: "--color-fg-muted",
  value: "--color-data-emphasis",
  unknown: "--color-state-unknown",
  footer: "--color-fg-muted",
  rule: "--color-hairline",
} as const satisfies Record<keyof CardPalette, `--color-${string}`>;

/**
 * 从 CSS 自定义属性读出一套颜色。
 *
 * 少任何一个都返回 `null` 而不是「用一个看起来差不多的颜色」—— 画布上没有兜底色，
 * 一个读不到的值会让 `fillStyle` 悄悄留上一笔的颜色，那比不画更糟。
 */
export function readCardPalette(root: HTMLElement | null = null): CardPalette | null {
  if (typeof window === "undefined") return null;
  const element = root ?? document.documentElement;
  if (!element) return null;

  const style = window.getComputedStyle(element);
  const values = Object.entries(PALETTE_TOKENS).map(([key, token]) => [
    key,
    style.getPropertyValue(token).trim(),
  ] as const);

  if (values.some(([, value]) => value.length === 0)) return null;
  return Object.fromEntries(values) as unknown as CardPalette;
}

/* -------------------------------------------------------------------------- */
/* 绘制                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 卡片上的字体栈 —— 每种语言挑最能读出自己字形的系统字体，最后兜到 sans-serif。
 *
 * 这是 `tokens.css` 里 `--font-ui` / `--font-ui-hant` / `--font-ui-ja` 的镜像：
 * `ctx.font` 不会解析 `var(--…)`，而「同一个汉字在日语里用简体字形渲染」这件事
 * 在画布上同样成立，所以按语言各带一份。写的是**字族名**，不是色值也不是时长，
 * 不受令牌规则约束。英语与简体共用同一份：拉丁字形回退一致，而英语卡片上的
 * 用户数据（仓库名、简介）本来就可能是中文。
 */
const FONT_STACKS: Record<Locale, string> = {
  "zh-Hans":
    '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif',
  "zh-Hant":
    '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", "Noto Sans SC", system-ui, -apple-system, sans-serif',
  en: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif',
  ja: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", "Noto Sans SC", system-ui, -apple-system, sans-serif',
};

const PAD = 96;

type Ctx = CanvasRenderingContext2D;

function fill(ctx: Ctx, color: string) {
  ctx.fillStyle = color;
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
) {
  ctx.font = font;
  fill(ctx, color);
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

/**
 * 把模型画到一张已经存在的画布上。
 *
 * 只做排版：所有「写什么字」的决定在上面那一步就做完了。
 * 返回 `false` 表示这个环境拿不到 2D 上下文（画布不可用），画布没有被改动。
 */
export function paintShareCard(
  canvas: HTMLCanvasElement,
  model: ShareCardModel,
  palette: CardPalette,
  locale: Locale = getActiveLocale(),
): boolean {
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const fontStack = FONT_STACKS[locale];

  fill(ctx, palette.background);
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  /* 一道细金边：视觉系统里卡片的边是被「切」出来的，这里用一条线代替，
     不引入任何新的图形语言。 */
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, SHARE_CARD_WIDTH - 96, SHARE_CARD_HEIGHT - 96);

  text(ctx, model.siteName, PAD, 190, `500 34px ${fontStack}`, palette.siteName);

  text(ctx, model.titleName, PAD, 380, `700 104px ${fontStack}`, palette.title);
  text(ctx, model.login, PAD, 500, `400 68px ${fontStack}`, palette.login);

  ctx.strokeStyle = palette.rule;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 600);
  ctx.lineTo(SHARE_CARD_WIDTH - PAD, 600);
  ctx.stroke();

  /* 三行，标签在左、值在右。值右对齐 —— 数字对齐之后才好读。 */
  model.rows.forEach((row, index) => {
    const y = 720 + index * 150;
    text(ctx, row.label, PAD, y, `400 40px ${fontStack}`, palette.label);
    text(
      ctx,
      row.value,
      SHARE_CARD_WIDTH - PAD,
      y,
      `500 56px ${fontStack}`,
      row.unknown ? palette.unknown : palette.value,
      "right",
    );
  });

  text(ctx, model.readAtValue, PAD, SHARE_CARD_HEIGHT - 150, `400 32px ${fontStack}`, palette.footer);
  if (model.host.length > 0) {
    text(
      ctx,
      model.host,
      SHARE_CARD_WIDTH - PAD,
      SHARE_CARD_HEIGHT - 150,
      `400 32px ${fontStack}`,
      palette.footer,
      "right",
    );
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* 对外入口                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 生成一张 PNG。
 *
 * 任何一步做不到都返回 `null` —— 画布不存在、拿不到 2D 上下文、`toBlob` 不支持、
 * 编码失败。调用方据此把「保存图片」收起来，页面其余部分不受影响。
 */
export async function createShareCard(
  input: ShareCardInput,
  locale: Locale = getActiveLocale(),
  host: string | null = null,
): Promise<Blob | null> {
  const palette = readCardPalette();
  if (palette === null) return null;

  const canvas = document.createElement("canvas");
  if (typeof canvas.toBlob !== "function") return null;

  if (
    !paintShareCard(
      canvas,
      buildShareCardModel(input, locale, host),
      palette,
      locale,
    )
  ) {
    return null;
  }

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
