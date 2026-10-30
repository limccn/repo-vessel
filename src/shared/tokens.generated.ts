/**
 * 颜色令牌的服务端镜像 —— **生成文件，不要手改**。
 *
 * 源：`src/frontend/styles/tokens.css`（唯一手写色值的地方）
 * 重新生成：`npm run tokens`
 *
 * 只有 Worker 侧需要它：SVG 渲染器读不到 CSS 变量，必须拿到真正的色值。
 * `npm run audit:design` 的 D1 规则会检查这份镜像与源文件一致，
 * 令牌改了而没重新生成时构建失败 —— 镜像不会悄悄过期。
 */

export const COLOR_TOKENS = {
  "bg-base": "#0c1211",
  "bg-void": "#060a09",
  "surface-panel": "#1e211d",
  "surface-panel-raised": "#242820",
  "surface-inset": "#141816",
  "surface-overlay": "#232722",
  "gold": "#c9a227",
  "gold-bright": "#e4c463",
  "teal": "#46b89a",
  "arcane": "#9aa0e0",
  "alert-warn": "#e0a340",
  "alert-stop": "#ea6a57",
  "state-unknown": "#8a9189",
  "fg-primary": "#e9e3d3",
  "fg-secondary": "#a9a79c",
  "fg-muted": "#95968b",
  "data-emphasis": "#d8f0e4",
  "data-secondary": "#9fafa6",
  "on-accent": "#14170f",
  "hairline": "rgb(233 227 211 / 0.1)",
  "hairline-soft": "rgb(233 227 211 / 0.06)",
  "bevel": "rgb(255 255 255 / 0.05)",
  "gold-soft": "rgb(201 162 39 / 0.42)",
  "gold-faint": "rgb(201 162 39 / 0.16)",
  "teal-faint": "rgb(70 184 154 / 0.16)",
  "arcane-faint": "rgb(154 160 224 / 0.16)",
} as const;

export type ColorTokenName = keyof typeof COLOR_TOKENS;
