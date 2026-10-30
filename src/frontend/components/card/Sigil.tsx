import { sigilFor, type SigilGlyph, type SigilHue } from "@/frontend/lib/sigil";
import { cx } from "@/frontend/lib/cx";

const HUE_COLOR: Record<SigilHue, string> = {
  gold: "var(--color-gold)",
  teal: "var(--color-teal)",
  arcane: "var(--color-arcane)",
  stone: "var(--color-state-unknown)",
};

/** 每个字形的 24×24 路径。1.5px 线性描边，不用填充表达状态。 */
const GLYPH_PATH: Record<SigilGlyph, string[]> = {
  gate: ["M6 20v-9a6 6 0 0 1 12 0v9", "M4 20h16", "M12 8v12"],
  lantern: ["M10 3h4", "M9 7h6l1.5 3v9a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-9z", "M9 12h6"],
  arch: ["M4 21v-9a8 8 0 0 1 16 0v9", "M8 21v-9a4 4 0 0 1 8 0v9"],
  urn: [
    "M8 4h8",
    "M9 4 8 8c-2 1.6-3 3.6-3 6a7 7 0 0 0 14 0c0-2.4-1-4.4-3-6l-1-4",
    "M9 15h6",
  ],
  key: ["M14.5 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", "M11.6 11.6 4 19.2l1.6 1.6 1.4-1.4 1.4 1.4 1.4-1.4 1-1"],
  eye: ["M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z", "M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"],
  wave: ["M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3-3 5-1"],
  spiral: [
    "M12 12.5a3 3 0 1 1 3 3 6 6 0 0 1-6-6 9 9 0 0 1 9 9c0 4-3 6.5-6.5 6.5",
  ],
};

export interface SigilProps {
  /** 仓库全名 `owner/repo`。同样的输入永远得到同样的纹章。 */
  name: string;
  /** 边长（px）。 */
  size?: number;
  /** 是否播放呼吸动效。默认否 —— 网格里一排纹章一起呼吸很吵。 */
  breathe?: boolean;
  className?: string;
}

/**
 * 纹章 —— 卡片「肖像」位的程序化图形。
 *
 * 它不是头像，也不代表任何人。主体是仓库。
 */
export function Sigil({ name, size = 48, breathe = false, className }: SigilProps) {
  const spec = sigilFor(name);
  const color = HUE_COLOR[spec.hue];

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx(className, breathe && "animate-sigil-breathe")}
      /* 纹章是装饰：它不携带仓库名以外的信息，而仓库名就在它旁边。
         视觉系统 §10「装饰」一行规定：印记与计量条、扫光一样，对辅助技术隐藏。 */
      aria-hidden="true"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform={`rotate(${spec.rotation} 12 12)`}>
        {GLYPH_PATH[spec.glyph].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
