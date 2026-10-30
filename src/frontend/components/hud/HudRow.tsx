import type { ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export interface HudRowProps {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}

/**
 * HUD 统计行 —— 标签、点线引线、右对齐数值。
 *
 * 数值用等宽数字（tabular-nums），一列数字才能对齐。
 */
export function HudRow({ label, value, className }: HudRowProps) {
  return (
    <div className={cx("hud-row", className)}>
      <span className="hud-row__label">{label}</span>
      <span aria-hidden="true" className="hud-row__leader" />
      <span className="hud-row__value tnum">{value}</span>
    </div>
  );
}
