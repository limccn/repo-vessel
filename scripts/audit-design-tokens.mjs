#!/usr/bin/env node
/**
 * 码之灵龛 · 设计系统护栏
 * ---------------------------------------------------------------------------
 * 把 `docs/dota2-visual-system.md` 里写死的规则变成一条可重复执行的命令。
 * 这个脚本不生成任何东西，只做检查；它要么全绿退出 0，要么逐条报错退出 1。
 *
 *   node scripts/audit-design-tokens.mjs
 *
 * 覆盖的规则：
 *   A1  组件里不许出现裸 hex 颜色
 *   A2  组件里不许出现手写时长
 *   A3  禁止词表（墓碑 / 骷髅 / 坟土 / 乌云 / 闪电 / 破碎玻璃 / 乌鸦）
 *   B1  令牌文件里声明的每一个令牌都必须进入产物 CSS
 *   B2  产物 CSS 里不许出现悬空的 var() 引用
 *   B3  产物 CSS 里不许泄漏 Tailwind 默认色板
 *   C1  每个前景色在每个底色上的对比度 ≥ 4.5:1
 *   C2  压在强调色上的文字在每个强调色上 ≥ 4.5:1
 *
 * 对比度数字只由本脚本产生。文档里的表格是抄它的，不是手写的。
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const TOKENS_CSS = join(ROOT, "src", "frontend", "styles", "tokens.css");
const SRC_DIR = join(ROOT, "src");
const DOCS_DIR = join(ROOT, "docs");
const DIST_DIR = join(ROOT, "dist");

/* ========================================================================== */
/* 工具                                                                        */
/* ========================================================================== */

const failures = [];
const notes = [];

function fail(rule, message) {
  failures.push({ rule, message });
}

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, filter));
    else if (filter(full)) out.push(full);
  }
  return out;
}

function rel(path) {
  return relative(ROOT, path).split(sep).join("/");
}

/** 收集文件里所有匹配的行，供报告定位。 */
function findLines(files, pattern) {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line, index) => {
      if (pattern.test(line)) hits.push(`${rel(file)}:${index + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

/* ========================================================================== */
/* A 组 —— 源码纪律                                                            */
/* ========================================================================== */

const tsFiles = walk(SRC_DIR, (f) => /\.tsx?$/.test(f));
const cssFiles = walk(SRC_DIR, (f) => f.endsWith(".css"));

// A1 · 裸 hex。tokens.css 是唯一允许出现 hex 的地方。
const hexHits = findLines(
  tsFiles,
  /#[0-9a-fA-F]{3,8}\b/,
).filter(
  (hit) =>
    !hit.startsWith("src/frontend/styles/tokens.css") &&
    /* 生成文件：`npm run tokens` 从 tokens.css 抄出来的服务端镜像。它没有手写的
       色值，D1 规则保证它和源文件一致 —— 白名单白的是「不是手写的」，不是「随便写」。 */
    !hit.startsWith("src/shared/tokens.generated.ts"),
);
for (const hit of hexHits) fail("A1", `组件里出现裸 hex 颜色 —— ${hit}`);

const cssHexHits = findLines(
  cssFiles.filter((f) => !f.endsWith("tokens.css")),
  /#[0-9a-fA-F]{3,8}\b/,
);
for (const hit of cssHexHits) fail("A1", `CSS 里出现裸 hex 颜色 —— ${hit}`);

// A2 · 手写时长。tokens.css 与 keyframes 之外不允许出现。
const durationHits = findLines(
  [...tsFiles, ...cssFiles.filter((f) => !f.endsWith("tokens.css"))],
  /(?<![\w-])[0-9]+(?:\.[0-9]+)?m?s(?![\w-])/,
).filter((hit) => !/\bkeyframe|animation-duration/.test(hit));
for (const hit of durationHits) fail("A2", `出现手写时长 —— ${hit}`);

// A3 · 禁止词表。规范文件本身在定义这张表，允许出现。
const FORBIDDEN = ["墓碑", "骷髅", "坟土", "乌云", "闪电", "破碎玻璃", "乌鸦"];
const vocabularyFiles = [
  ...walk(SRC_DIR, (f) => /\.(tsx?|css)$/.test(f)),
  ...walk(DOCS_DIR, (f) => f.endsWith(".md") && !f.includes("interaction-design-spec")),
];
for (const word of FORBIDDEN) {
  // 定义这张表的那一行本身不算违规。
  const hits = findLines(vocabularyFiles, new RegExp(word)).filter(
    (hit) => !hit.includes("禁止词表"),
  );
  for (const hit of hits) fail("A3", `禁止词「${word}」 —— ${hit}`);
}

/* ========================================================================== */
/* B 组 —— 令牌完整性                                                          */
/* ========================================================================== */

const tokensSource = readFileSync(TOKENS_CSS, "utf8");

const declaredTokens = [
  ...new Set(
    [...tokensSource.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
  ),
];

const distAssets = existsSync(DIST_DIR) ? walk(DIST_DIR, (f) => f.endsWith(".css")) : [];

if (distAssets.length === 0) {
  notes.push("B1/B2/B3 · 跳过：dist/ 里没有 CSS，先跑 npm run build");
} else {
  const builtCss = distAssets.map((f) => readFileSync(f, "utf8")).join("\n");

  // B1 · 声明的令牌必须进入产物。
  for (const token of declaredTokens) {
    if (!new RegExp(`${token}\\s*:`).test(builtCss)) {
      fail("B1", `令牌 ${token} 没有进入产物 CSS —— @theme 需要写成 @theme static`);
    }
  }

  // B2 · 产物里不许有悬空的 var()。
  const builtDefined = new Set(
    [...builtCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
  // 这些是运行时由组件写入的内联变量，CSS 里带兜底值，不算悬空。
  const RUNTIME = new Set([
    "--meter-from",
    "--meter-to",
    "--rarity-edge",
    "--rarity-fill",
    "--rarity-glow",
  ]);
  for (const match of builtCss.matchAll(/var\((--[a-z0-9-]+)([^)]*)\)/g)) {
    const name = match[1];
    if (RUNTIME.has(name)) continue;
    if (!builtDefined.has(name) && !match[2].includes(",")) {
      fail("B2", `产物 CSS 里 ${name} 没有定义也没有兜底值`);
    }
  }

  // B3 · Tailwind 默认色板不许泄漏。
  for (const leak of ["--color-slate-", "--color-gray-", "--color-red-", "--color-blue-", "--color-green-", "--color-zinc-", "--color-neutral-"]) {
    if (builtCss.includes(leak)) fail("B3", `产物 CSS 里泄漏了 Tailwind 默认色板 ${leak}`);
  }
}

/* ========================================================================== */
/* C 组 —— 对比度                                                              */
/* ========================================================================== */

function parseColor(value) {
  const hex = value.trim().match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length === 6) h += "ff";
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      parseInt(h.slice(6, 8), 16) / 255,
    ];
  }
  const rgb = value.trim().match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    const alpha = parts.length > 3 ? parseFloat(parts[3]) : 1;
    return [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]), alpha];
  }
  return null;
}

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const colors = new Map();
for (const match of tokensSource.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  const parsed = parseColor(match[2]);
  if (parsed) colors.set(match[1], parsed);
}

const isSurface = (name) => name.startsWith("--color-bg-") || name.startsWith("--color-surface-");
const surfaces = [...colors.keys()].filter(isSurface);
const accents = ["--color-gold", "--color-gold-bright", "--color-teal", "--color-arcane"];
const foregrounds = [...colors.keys()].filter((name) => {
  if (isSurface(name)) return false;
  if (name === "--color-on-accent") return false;
  if (name.endsWith("-soft") || name.endsWith("-faint")) return false;
  if (name.startsWith("--color-hairline")) return false;
  if (name === "--color-bevel") return false;
  if (colors.get(name)[3] < 1) return false; // 半透明的不做文字对比度
  return true;
});

const AA = 4.5;

/** 只打印对比度表（Markdown），供文档抄用。 */
const printTable = process.argv.includes("--table");

const FOREGROUND_ORDER = [
  "--color-fg-primary",
  "--color-fg-secondary",
  "--color-fg-muted",
  "--color-gold",
  "--color-gold-bright",
  "--color-teal",
  "--color-arcane",
  "--color-alert-warn",
  "--color-alert-stop",
  "--color-state-unknown",
  "--color-data-emphasis",
  "--color-data-secondary",
  "--rarity-common",
  "--rarity-rare",
  "--rarity-epic",
  "--rarity-legendary",
];
const SURFACE_ORDER = [
  "--color-bg-base",
  "--color-surface-panel",
  "--color-surface-panel-raised",
  "--color-surface-overlay",
  "--color-surface-inset",
];

if (printTable) {
  const head = ["前景", ...SURFACE_ORDER.map((s) => s.replace("--color-", "")), "最小值"];
  console.log(`| ${head.join(" | ")} |`);
  console.log(`|${"---|".repeat(head.length)}`);
  for (const fg of FOREGROUND_ORDER) {
    if (!colors.has(fg)) continue;
    const hex = `#${[0, 1, 2]
      .map((i) => colors.get(fg)[i].toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
    const ratios = SURFACE_ORDER.map((bg) => contrast(colors.get(fg), colors.get(bg)));
    const min = Math.min(...ratios);
    console.log(
      `| \`${fg}\` \`${hex}\` | ${ratios.map((r) => r.toFixed(2)).join(" | ")} | **${min.toFixed(2)}** |`,
    );
  }
  console.log("");
  console.log(`压在强调色上的文字 \`--color-on-accent\`：`);
  for (const bg of accents) {
    console.log(
      `- \`${bg}\` → ${contrast(colors.get("--color-on-accent"), colors.get(bg)).toFixed(2)}:1`,
    );
  }
  process.exit(0);
}

for (const fg of foregrounds) {
  for (const bg of surfaces) {
    const ratio = contrast(colors.get(fg), colors.get(bg));
    if (ratio < AA) {
      fail("C1", `对比度不足：${fg} 在 ${bg} 上是 ${ratio.toFixed(2)}:1（需要 ≥ ${AA}）`);
    }
  }
}

for (const bg of accents) {
  const ratio = contrast(colors.get("--color-on-accent"), colors.get(bg));
  if (ratio < AA) {
    fail("C2", `对比度不足：--color-on-accent 在 ${bg} 上是 ${ratio.toFixed(2)}:1（需要 ≥ ${AA}）`);
  }
}

/* ========================================================================== */
/* D 组 —— 生成物与源文件一致                                                   */
/* ========================================================================== */

// D1 · 颜色令牌的服务端镜像（src/shared/tokens.generated.ts）必须与 tokens.css 一致。
//      Worker 的 SVG 渲染器读不到 CSS 变量，只能读这份镜像；令牌改了而没重新生成，
//      OG 图就会悄悄用上一套过期的颜色。`npm run tokens` 重新生成。
const MIRROR = join(SRC_DIR, "shared", "tokens.generated.ts");
if (existsSync(MIRROR)) {
  const mirror = readFileSync(MIRROR, "utf8");
  const mirrored = new Map(
    [...mirror.matchAll(/"([a-z0-9-]+)":\s*"([^"]+)",/g)].map((m) => [m[1], m[2]]),
  );
  for (const [name, value] of colorsRaw()) {
    const got = mirrored.get(name);
    if (got === undefined) fail("D1", `镜像缺令牌 --color-${name} —— 跑 npm run tokens`);
    else if (got !== value) {
      fail("D1", `镜像里的 --color-${name} 是 ${got}，源文件是 ${value} —— 跑 npm run tokens`);
    }
  }
  for (const name of mirrored.keys()) {
    if (!colorsRaw().some(([n]) => n === name)) {
      fail("D1", `镜像多的令牌 --color-${name} 在 tokens.css 里已经不存在 —— 跑 npm run tokens`);
    }
  }
}

/** tokens.css 里所有颜色令牌的 `[名字, 原值]`，顺序与文件一致。 */
function colorsRaw() {
  return [...tokensSource.matchAll(/^\s*--color-([a-z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => [
    m[1],
    m[2].trim(),
  ]);
}

/* ========================================================================== */
/* 报告                                                                        */
/* ========================================================================== */

console.log("码之灵龛 · 设计系统护栏");
console.log("=".repeat(60));
console.log(`令牌总数        ${declaredTokens.length}`);
console.log(`前景色 / 底色   ${foregrounds.length} / ${surfaces.length}`);
if (notes.length) {
  for (const note of notes) console.log(`注意            ${note}`);
}

if (failures.length === 0) {
  console.log("=".repeat(60));
  console.log("全部通过。");
  process.exit(0);
}

console.log("=".repeat(60));
for (const { rule, message } of failures) console.log(`✗ ${rule}  ${message}`);
console.log(`\n${failures.length} 条问题。`);
process.exit(1);
