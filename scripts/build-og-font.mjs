#!/usr/bin/env node
/**
 * 生成 OG 图用的字体子集（简体 / 繁体 / 日语各一对）。
 *
 * **为什么要有子集。** 完整的 Noto Sans SC 是 17 MB，而 OG 图只写固定的几十个字
 * （站名、六个称号、几个标签、数字与 ASCII）。按 `og-vocabulary.json` 切出来的
 * 子集每份不到 100 KB —— 为「画一张 1200×630 的横版卡」付出 17 MB 是不成比例的。
 *
 * **为什么是三种语言、各两个文件。** 三种语言的固定文案用到的汉字不同（繁体的
 * 「讀取於」、日语的「取得日時」），一份子集要么漏字、要么把三套字形全塞进去。
 * 而源字体是可变字体，resvg 不会去插值字重轴：只载入一份可变字体时，
 * `font-weight="700"` 和 `400` 画出来逐字节相同（量过）。所以每种语言把 `wght`
 * 轴**各自钉死**再切 —— 400 与 700 各一份静态字体，SVG 里写 `font-weight`
 * 才真的有粗细。英语借用简体那一份：它唯一的非 ASCII 字符是罗马数字与 ★。
 *
 *   npm run og-font
 *
 * 源字体不入库（合计每份 9–17 MB，且随时可以重新下载）。放在：
 *
 *   scripts/.fonts/NotoSansSC.ttf
 *   scripts/.fonts/NotoSansTC.ttf
 *   scripts/.fonts/NotoSansJP.ttf
 *
 * 或用 `OG_FONT_SOURCE_SC` / `OG_FONT_SOURCE_TC` / `OG_FONT_SOURCE_JP` 指到别处。
 * 下载：https://github.com/google/fonts/tree/main/ofl/notosanssc（OFL-1.1，TC / JP 同）
 *
 * 生成物 `og-font.<locale>.ttf` / `og-font.<locale>-bold.ttf` **入库** —— 部署环境
 * 不需要这个脚本，而 `npm run audit:og-font` 会确认它们覆盖了当前文案的每一个字。
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import subsetFont from "subset-font";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_SOURCE_DIR = join(ROOT, "scripts", ".fonts");
const VOCABULARY = join(ROOT, "src", "worker", "share", "og-vocabulary.json");
const OUT_DIR = join(ROOT, "src", "worker", "share");

/**
 * 每种语言的源字体与输出。
 *
 * `locale` 与 `src/shared/i18n.ts` 的 `Locale` 一一对应；`en` 不在这里 ——
 * 它复用 `zh-Hans` 那一对（见 `render.ts` 的 `FONTS` 表）。
 */
const SOURCES = [
  {
    locale: "zh-Hans",
    env: "OG_FONT_SOURCE_SC",
    file: "NotoSansSC.ttf",
    download: "https://github.com/google/fonts/tree/main/ofl/notosanssc",
  },
  {
    locale: "zh-Hant",
    env: "OG_FONT_SOURCE_TC",
    file: "NotoSansTC.ttf",
    download: "https://github.com/google/fonts/tree/main/ofl/notosanstc",
  },
  {
    locale: "ja",
    env: "OG_FONT_SOURCE_JP",
    file: "NotoSansJP.ttf",
    download: "https://github.com/google/fonts/tree/main/ofl/notosansjp",
  },
];

/** 与 `render.ts` 的字体导入一一对应。 */
const WEIGHTS = [
  { weight: 400, suffix: "" },
  { weight: 700, suffix: "-bold" },
];

/* 字形表是 JSON 而不是 .ts：这个脚本要在没有 TypeScript 编译器的 Node 上跑。 */
const vocabulary = JSON.parse(readFileSync(VOCABULARY, "utf8"));
const ASCII = vocabulary.asciiPrintable;
const LOCALE_GLYPHS = vocabulary.locales;

const started = Date.now();
let total = 0;
let missing = 0;

for (const source of SOURCES) {
  const path = process.env[source.env] ?? join(FONT_SOURCE_DIR, source.file);

  if (!existsSync(path)) {
    console.error(`找不到源字体：${path}`);
    console.error(`  把它放在那个路径，或者 ${source.env}=/path/to/${source.file} npm run og-font`);
    console.error(`  下载：${source.download}`);
    missing += 1;
    continue;
  }

  const glyphs = ASCII + (LOCALE_GLYPHS[source.locale] ?? "");
  const unique = new Set([...glyphs]);
  const bytes = readFileSync(path);

  for (const { weight, suffix } of WEIGHTS) {
    const subset = await subsetFont(bytes, [...unique].join(""), {
      targetFormat: "truetype",
      variationAxes: { wght: weight },
    });
    const output = `og-font.${source.locale}${suffix}.ttf`;
    writeFileSync(join(OUT_DIR, output), subset);
    total += subset.length;
    console.log(
      `✓ ${source.locale} ${weight} · ${unique.size} 个字符 → ${output}（${(subset.length / 1024).toFixed(0)} KB）`,
    );
  }
}

if (missing > 0) process.exit(1);

console.log(`  合计 ${(total / 1024).toFixed(0)} KB`);
console.log(`  ${Date.now() - started} ms`);
console.log("");
console.log("  别忘了跑 npm run audit:og-font 确认字形齐全。");
