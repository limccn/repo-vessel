/**
 * SVG → PNG（resvg + WASM）。
 *
 * **WASM 只初始化一次。** 每个 isolate 首次画图时实例化，之后复用同一个实例 ——
 * 逐请求实例化要付 2.4 MB 的编译开销，而 OG 图是缓存命中率极高的冷路径，
 * 那笔开销会全部落在第一批分享出去的那一刻。
 *
 * 字体是**构建期子集**（`scripts/build-og-font.mjs`），只含 `og-vocabulary.json`
 * 里那几个字。每种语言一份（简体 / 繁体 / 日语），两个字重各是独立的静态字体，
 * 不是一份可变字体：resvg 不插值字重轴，只给一份可变字体时 `font-weight="700"`
 * 画出来和 400 逐字节相同。
 *
 * 字体文件按模块顶层静态 import —— Wrangler 的 `Data` 规则认的是构建期能看见的
 * 静态导入，动态路径拿不到文件。六份字体合计约 500 KB，比一张 OG 图重，但它们是
 * **构建期**读进 Worker 的字节，不是每个请求都过一遍。
 *
 * `loadSystemFonts: false` 是刻意的 —— Worker 里没有系统字体可读。
 *
 * 初始化失败时把 `ready` 清空再抛 —— 一次瞬时失败不该把这个 isolate 永久
 * 钉死成「画不出来」。
 */

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasmModule from "@resvg/resvg-wasm/index_bg.wasm";
import { DEFAULT_LOCALE, type Locale } from "@/shared/i18n";
import fontHans from "./og-font.zh-Hans.ttf";
import fontHansBold from "./og-font.zh-Hans-bold.ttf";
import fontHant from "./og-font.zh-Hant.ttf";
import fontHantBold from "./og-font.zh-Hant-bold.ttf";
import fontJa from "./og-font.ja.ttf";
import fontJaBold from "./og-font.ja-bold.ttf";
import { ogFontFamily } from "./svg";

interface FontPair {
  family: string;
  regular: ArrayBuffer;
  bold: ArrayBuffer;
}

/** 每种语言的族名与两份字体。英语借用简体那一份 —— 它只用得到 ASCII 与 Ⅳ ★。 */
const FONTS: Record<Locale, FontPair> = {
  "zh-Hans": { family: "Noto Sans SC", regular: fontHans, bold: fontHansBold },
  en: { family: "Noto Sans SC", regular: fontHans, bold: fontHansBold },
  "zh-Hant": { family: "Noto Sans TC", regular: fontHant, bold: fontHantBold },
  ja: { family: "Noto Sans JP", regular: fontJa, bold: fontJaBold },
};

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  ready ??= initWasm(wasmModule).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

/** 抛出的错误由调用方降级处理（见 `routes.ts`：302 到品牌图）。 */
export async function renderOgPng(
  svg: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Uint8Array> {
  await ensureReady();

  const fonts = FONTS[locale] ?? FONTS[DEFAULT_LOCALE];
  const family = ogFontFamily(locale) || fonts.family;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      fontBuffers: [new Uint8Array(fonts.regular), new Uint8Array(fonts.bold)],
      loadSystemFonts: false,
      defaultFontFamily: family,
      sansSerifFamily: family,
    },
  });

  try {
    const rendered = resvg.render();
    try {
      return rendered.asPng();
    } finally {
      rendered.free();
    }
  } finally {
    resvg.free();
  }
}
