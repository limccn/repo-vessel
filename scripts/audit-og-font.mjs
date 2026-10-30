#!/usr/bin/env node
/**
 * 检查入库的 OG 字体是否覆盖当前文案用的每一个字 —— 每种语言各查一对。
 *
 * **它守的是一个静默失败。** 字体是二进制，改了一句中文而忘了 `npm run og-font`，
 * 代码照样编译、测试照样通过，只有图上那个字变成豆腐块 —— 而没人会盯着 OG 图看。
 * 所以这里直接读字体文件的 cmap，把该语言的字形表逐字对照，缺一个就退出 1。
 *
 * 每个字重各是一份子集，两份都要查：只有粗体那份缺字时，图上坏的是称号，
 * 而称号是卡片上最大的一行。
 *
 *   npm run audit:og-font
 *
 * 不依赖任何字体解析库：只读 cmap 表的 format 4 / format 12 子表，判断某个码位
 * 是否落在某个区间里。字形本身长什么样不关心。
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_DIR = join(ROOT, "src", "worker", "share");
const VOCABULARY = join(FONT_DIR, "og-vocabulary.json");

/* 与 scripts/build-og-font.mjs 的 SOURCES / WEIGHTS 一一对应。
   英语没有自己的字体：它复用 zh-Hans 那一对（见 render.ts）。 */
const LOCALES = ["zh-Hans", "zh-Hant", "ja"];
const WEIGHTS = ["", "-bold"];

/* 字形表是 JSON 而不是 .ts：这个脚本要在没有 TypeScript 编译器的 Node 上跑。 */
const vocabulary = JSON.parse(readFileSync(VOCABULARY, "utf8"));
const ASCII = vocabulary.asciiPrintable;
const LOCALE_GLYPHS = vocabulary.locales;

let failed = false;

for (const locale of LOCALES) {
  // 与 `og-text.ts` 的 `ogVocabulary()` 同一条规则：ASCII + 该语言的固定字。
  const glyphs = new Set([...(ASCII + (LOCALE_GLYPHS[locale] ?? ""))]);
  if (glyphs.size === ASCII.length) {
    console.error(`✗ og-vocabulary.json 里没有 ${locale} 的字形表。`);
    failed = true;
    continue;
  }

  for (const weight of WEIGHTS) {
    const name = `og-font.${locale}${weight}.ttf`;
    const font = join(FONT_DIR, name);
    if (!existsSync(font)) {
      console.error(`找不到 src/worker/share/${name} —— 跑 npm run og-font 生成它。`);
      failed = true;
      continue;
    }

    const buffer = readFileSync(font);
    const ranges = readCmapRanges(buffer);

    if (ranges.length === 0) {
      console.error(`${name} 里没有可用的 cmap 子表 —— 文件坏了，或者不是 TTF。`);
      failed = true;
      continue;
    }

    const missing = [...glyphs].filter(
      (char) => !ranges.some(([start, end]) => {
        const code = char.codePointAt(0) ?? 0;
        return code >= start && code <= end;
      }),
    );

    if (missing.length > 0) {
      console.error(`✗ ${name} 有 ${missing.length} 个字没有字形：${missing.join(" ")}`);
      console.error("  文案改了而字体没重新生成 —— 跑 npm run og-font。");
      failed = true;
      continue;
    }

    console.log(
      `✓ ${name} 覆盖 ${glyphs.size} 个字（${(buffer.length / 1024).toFixed(0)} KB）`,
    );
  }
}

if (failed) process.exit(1);

/* -------------------------------------------------------------------------- */
/* 最小 TTF 读取                                                               */
/* -------------------------------------------------------------------------- */

/** 返回 cmap 覆盖的码位区间，已排序合并。 */
function readCmapRanges(buf) {
  const tableOffset = findTable(buf, "cmap");
  if (tableOffset === null) return [];

  const subtables = buf.readUInt16BE(tableOffset + 2);
  const candidates = [];
  for (let i = 0; i < subtables; i += 1) {
    const record = tableOffset + 4 + i * 8;
    const platform = buf.readUInt16BE(record);
    const encoding = buf.readUInt16BE(record + 2);
    const offset = tableOffset + buf.readUInt32BE(record + 4);
    const format = buf.readUInt16BE(offset);
    /* 优先 Unicode 全字符平面（3/10 或 0/4 的 format 12），其次 BMP（format 4）。 */
    const rank = format === 12 ? 0 : format === 4 ? 1 : 9;
    if (platform !== 3 && platform !== 0) continue;
    if (encoding === 10 || encoding === 4) candidates.push({ rank: rank - 0.5, offset, format });
    else candidates.push({ rank, offset, format });
  }
  if (candidates.length === 0) return [];

  candidates.sort((a, b) => a.rank - b.rank);
  const best = candidates[0];
  const out =
    best.format === 12 ? format12Ranges(buf, best.offset) : format4Ranges(buf, best.offset);
  return out.sort((a, b) => a[0] - b[0]);
}

function findTable(buf, tag) {
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    if (buf.toString("latin1", record, record + 4) === tag) {
      return buf.readUInt32BE(record + 8);
    }
  }
  return null;
}

function format4Ranges(buf, offset) {
  const segCount = buf.readUInt16BE(offset + 6) / 2;
  const endAt = offset + 14;
  const startAt = endAt + segCount * 2 + 2;
  const ranges = [];
  for (let i = 0; i < segCount; i += 1) {
    const end = buf.readUInt16BE(endAt + i * 2);
    const start = buf.readUInt16BE(startAt + i * 2);
    if (start !== 0xffff) ranges.push([start, end]);
  }
  return ranges;
}

function format12Ranges(buf, offset) {
  const groups = buf.readUInt32BE(offset + 12);
  const ranges = [];
  for (let i = 0; i < groups; i += 1) {
    const at = offset + 16 + i * 12;
    ranges.push([buf.readUInt32BE(at), buf.readUInt32BE(at + 4)]);
  }
  return ranges;
}
