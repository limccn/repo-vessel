#!/usr/bin/env node
/**
 * 生成 OG 图用的字形表（`src/worker/share/og-vocabulary.json`）。
 *
 * **为什么要有这张表。** 卡片上只画固定的几十个字（站名、六个称号、几行标签、
 * 罗马数字与 ★），加上 GitHub 用户名与域名里的 ASCII。字体按这张表切子集，
 * 每份不到 100 KB；按整份字体走就是 9–17 MB。表多一个字只是字体大一点，
 * 少一个字就是图上的豆腐块 —— 所以这张表唯一重要的性质是**够全**。
 *
 * **它从哪儿来。** 键在词典里，所以这里直接读 `src/shared/i18n-dictionaries.ts`，
 * 按卡片真正会画的那些 msgid 取三种语言的译文。`scripts/build-og-font.mjs` 与
 * `scripts/audit-og-font.mjs` 都读这份 JSON，两边是同一个清单。
 *
 * 卡片实际画出来的每一个字都由 `src/worker/share/svg.test.ts` 逐个比对 ——
 * 这里漏了一条，测试先失败。也就是说：这张表可以手写，但不该手写。
 *
 *   npm run og-vocabulary
 *
 * 这个脚本要在没有 TypeScript 编译器的 Node 20 上跑，所以它用 `new Function`
 * 求值词典文件里那三个对象字面量（它们是纯字面量，没有 import、没有调用）。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DICTIONARIES = join(ROOT, "src", "shared", "i18n-dictionaries.ts");
const OUTPUT = join(ROOT, "src", "worker", "share", "og-vocabulary.json");

/** 可打印 ASCII（U+0020–U+007E）。用户名、域名、数字、拉丁站名都在这里。 */
const ASCII_PRINTABLE = Array.from({ length: 95 }, (_, index) =>
  String.fromCharCode(32 + index),
).join("");

/**
 * 卡片会画的固定文案。
 *
 * 与 `src/worker/share/svg.ts` 一一对应：站名、四行标签、等级名、六种称号、
 * 五档等级标记。改卡片文案时这里跟着改，`svg.test.ts` 会把漏掉的字指出来。
 */
const CARD_MSGIDS = [
  "码之灵龛",
  "Repo Vessel",
  "带主题仓库",
  "最长沉睡",
  "读取于",
  "? 未知",
  "灵龛充能等级",
  "未启封",
  "Ⅰ 阶",
  "Ⅱ 阶",
  "Ⅲ 阶",
  "Ⅳ 阶",
  "时光收藏家",
  "余烬守护者",
  "Fork 漂流者",
  "想法播种者",
  "轻装旅人",
  "初访者",
  "·",
  "Ⅰ",
  "Ⅱ",
  "Ⅲ",
  "Ⅳ",
  "★",
];

/**
 * 不在词典里、由 `src/shared/format.ts` 拼出来的字。
 *
 * 「4,967 天」「12 个」里的量词是语法，不是文案，所以它留在代码里 —— 但字体
 * 不认识语法，只认识字。这里是它们唯一的一份来源。
 */
const FORMATTER_GLYPHS = {
  "zh-Hans": "天个",
  "zh-Hant": "天個",
  ja: "日個",
  en: "",
};

/* -------------------------------------------------------------------------- */
/* 读词典                                                                      */
/* -------------------------------------------------------------------------- */

const source = readFileSync(DICTIONARIES, "utf8");
const patched = source.replace(
  /export const (EN|ZH_HANT|JA): Record<string, string> =/g,
  "const $1 =",
);

const loadDictionaries = new Function(
  `${patched}\nreturn { EN, ZH_HANT, JA };`,
);
const DICTIONARIES_BY_LOCALE = { en: "EN", "zh-Hant": "ZH_HANT", ja: "JA" };
const tables = loadDictionaries();

/** 简体没有译文 —— 它的「译文」就是 msgid 本身。 */
function stringsFor(locale) {
  if (locale === "zh-Hans") return CARD_MSGIDS;
  const table = tables[DICTIONARIES_BY_LOCALE[locale]];
  return CARD_MSGIDS.map((msgid) => table[msgid] ?? msgid);
}

function glyphsFor(locale) {
  const chars = new Set();
  for (const text of stringsFor(locale)) {
    for (const char of text) {
      if (char.codePointAt(0) > 0x7e) chars.add(char);
    }
  }
  for (const char of FORMATTER_GLYPHS[locale] ?? "") chars.add(char);
  return [...chars].sort().join("");
}

const vocabulary = {
  note: "OG 图上会出现的全部固定字符（按语言）。由 scripts/build-og-vocabulary.mjs 生成；工具：scripts/build-og-font.mjs / audit-og-font.mjs。改文案后跑 npm run og-vocabulary && npm run og-font。",
  asciiPrintable: ASCII_PRINTABLE,
  locales: {
    "zh-Hans": glyphsFor("zh-Hans"),
    "zh-Hant": glyphsFor("zh-Hant"),
    en: glyphsFor("en"),
    ja: glyphsFor("ja"),
  },
};

writeFileSync(OUTPUT, `${JSON.stringify(vocabulary, null, 2)}\n`, "utf8");

for (const [locale, glyphs] of Object.entries(vocabulary.locales)) {
  console.log(`✓ ${locale} · ${glyphs.length} 个字 → ${glyphs}`);
}
