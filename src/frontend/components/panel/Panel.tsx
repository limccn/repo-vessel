import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export type PanelVariant = "panel" | "raised" | "inset" | "overlay";
export type PanelEdge = "hairline" | "gold" | "soft" | "none";
export type PanelCut = "xs" | "sm" | "md" | "lg" | "xl";

const FILL: Record<PanelVariant, string> = {
  panel: "var(--color-surface-panel)",
  raised: "var(--color-surface-panel-raised)",
  inset: "var(--color-surface-inset)",
  overlay: "var(--color-surface-overlay)",
};

const EDGE: Record<PanelEdge, string> = {
  hairline: "var(--color-hairline)",
  gold: "var(--color-gold-soft)",
  soft: "var(--color-hairline-soft)",
  none: "transparent",
};

const CUT: Record<PanelCut, string> = {
  xs: "var(--cut-xs)",
  sm: "var(--cut-sm)",
  md: "var(--cut-md)",
  lg: "var(--cut-lg)",
  xl: "var(--cut-xl)",
};

export interface PanelProps {
  children: ReactNode;
  /** 面板材质面。 */
  variant?: PanelVariant;
  /** 描边。`gold` 用在需要被看见的那一块。 */
  edge?: PanelEdge;
  /** 切角尺寸。 */
  cut?: PanelCut;
  /** 四角的金属托架。 */
  brackets?: boolean;
  /** 石面颗粒。 */
  grain?: boolean;
  /** 顶部一道金属浮雕高光。 */
  bevel?: boolean;
  className?: string;
  innerClassName?: string;
  /** 语义标签。默认 `div`。 */
  as?: ElementType;
  /** 页内锚点。 */
  id?: string;
  /** 无障碍名称（当面板本身是一个 landmark 时）。 */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** `-1`：让面板可以作为程序化焦点的落点（页内跳转后不把焦点留在原地）。 */
  tabIndex?: number;
}

/**
 * 切角面板 —— Dota 面板的基本单位。
 *
 * 结构：外层画描边、内层画填充，两者共用同一条 clip-path，切角处因此留下一道
 * 楔形的金属边。描边不是 border，因为 border 会被 clip-path 切掉。
 */
export function Panel({
  children,
  variant = "panel",
  edge = "hairline",
  cut = "md",
  brackets = false,
  grain = false,
  bevel = false,
  className,
  innerClassName,
  as: Tag = "div",
  ...aria
}: PanelProps) {
  const style: CSSProperties = {
    "--frame-fill": FILL[variant],
    "--frame-edge": EDGE[edge],
    "--cut": CUT[cut],
  } as CSSProperties;

  return (
    <Tag
      style={style}
      className={cx("cut-frame", bevel && "bevel-top", className)}
      {...aria}
    >
      <div
        className={cx(
          "cut-frame__inner",
          grain && "grain",
          brackets && "corner-brackets",
          innerClassName,
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
