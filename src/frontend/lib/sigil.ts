/**
 * 纹章 —— 卡片的「肖像」位。
 *
 * 我们没有美术资源，也没有使用任何美术资源的许可。但每一张仓库卡都需要一个
 * 可以一眼区分的视觉锚点，否则网格会变成一堵字墙。
 *
 * 做法：由 `owner/repo` 派生一个确定性的 SVG 图形。同一个仓库永远得到同一个
 * 纹章；不需要存储任何资产，不需要网络请求，也不会出现两个仓库撞脸。
 *
 * 它**不是**头像。头像把注意力放在人身上，而本产品的主语始终是仓库。
 */

export const SIGIL_GLYPHS = [
  "gate",
  "lantern",
  "arch",
  "urn",
  "key",
  "eye",
  "wave",
  "spiral",
] as const;

export type SigilGlyph = (typeof SIGIL_GLYPHS)[number];

export const SIGIL_HUES = ["gold", "teal", "arcane", "stone"] as const;

export type SigilHue = (typeof SIGIL_HUES)[number];

export interface SigilSpec {
  glyph: SigilGlyph;
  hue: SigilHue;
  /** 15° 的整数倍。 */
  rotation: number;
}

/** FNV-1a。确定性、跨平台、无依赖。 */
function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], index: number): T {
  const value = items[index % items.length];
  // 数组长度是常量，index 已取模，这里不可能越界。
  if (value === undefined) throw new Error("sigil: empty palette");
  return value;
}

export function sigilFor(fullName: string): SigilSpec {
  const h = hash32(fullName);
  return {
    glyph: pick(SIGIL_GLYPHS, h),
    hue: pick(SIGIL_HUES, h >>> 8),
    rotation: pick([0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345], h >>> 16),
  };
}
