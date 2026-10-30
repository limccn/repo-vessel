#!/usr/bin/env node
/**
 * 把 `src/frontend/styles/tokens.css` 里的颜色令牌生成成一份 TypeScript 常量。
 *
 * **为什么需要这一步。** Worker 里的 SVG 渲染器没有 CSS 可用 —— resvg 拿到的是一段
 * 字符串，`var(--color-gold)` 在它眼里只是一串没人解析的字符。它必须拿到真正的色值。
 * 而 `audit:design` 的 A1 规则禁止 `tokens.css` 之外出现裸 hex，这条规则不能为了
 * 服务端渲染开一个口子，否则「只有一个地方写色值」就成了建议。
 *
 * 所以色值仍然只写在 `tokens.css`（唯一手写的地方），这里生成一份**只读镜像**，
 * 审计脚本 D1 规则检查两边一致 —— 令牌改了而镜像没重新生成，构建就会失败。
 *
 *   node scripts/build-tokens.mjs      # 重新生成
 *
 * 生成物是 `src/shared/tokens.generated.ts`，不要手改。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SOURCE = join(ROOT, "src", "frontend", "styles", "tokens.css");
const OUTPUT = join(ROOT, "src", "shared", "tokens.generated.ts");

const css = readFileSync(SOURCE, "utf8");

/* 只取颜色令牌：服务端渲染用不到字号、时长、间距。前缀 `--color-` 去掉，
   生成的对象读起来就是 `COLOR_TOKENS["gold"]`。 */
const entries = [...css.matchAll(/^\s*--color-([a-z0-9-]+)\s*:\s*([^;]+);/gm)].map(
  (match) => [match[1], match[2].trim()],
);

if (entries.length === 0) {
  console.error("没有从 tokens.css 里解析到任何颜色令牌 —— 文件结构变了？");
  process.exit(1);
}

const body = entries
  .map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)},`)
  .join("\n");

const output = `/**
 * 颜色令牌的服务端镜像 —— **生成文件，不要手改**。
 *
 * 源：\`src/frontend/styles/tokens.css\`（唯一手写色值的地方）
 * 重新生成：\`npm run tokens\`
 *
 * 只有 Worker 侧需要它：SVG 渲染器读不到 CSS 变量，必须拿到真正的色值。
 * \`npm run audit:design\` 的 D1 规则会检查这份镜像与源文件一致，
 * 令牌改了而没重新生成时构建失败 —— 镜像不会悄悄过期。
 */

export const COLOR_TOKENS = {
${body}
} as const;

export type ColorTokenName = keyof typeof COLOR_TOKENS;
`;

writeFileSync(OUTPUT, output, "utf8");
console.log(`✓ 生成 ${entries.length} 个颜色令牌 → src/shared/tokens.generated.ts`);
