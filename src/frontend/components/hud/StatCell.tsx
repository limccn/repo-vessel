import type { ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export interface StatCellProps {
  /** 线性描边的小图标。 */
  icon: ReactNode;
  value: ReactNode;
  label?: string;
  className?: string;
}

/** 统计格 —— 图标 + 数值。Dota HUD 里那块成排的数字。 */
export function StatCell({ icon, value, label, className }: StatCellProps) {
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <span aria-hidden="true" className="text-fg-muted">
        {icon}
      </span>
      <span className="tnum text-sm font-semibold text-data-secondary">{value}</span>
      {label ? <span className="text-2xs text-fg-muted">{label}</span> : null}
    </div>
  );
}
