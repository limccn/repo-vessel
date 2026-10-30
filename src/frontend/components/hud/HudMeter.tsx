import type { CSSProperties } from "react";
import { cx } from "@/frontend/lib/cx";

export interface HudMeterProps {
  /** 0–1。`null` 表示未知 —— 条留空，不画任何东西。 */
  ratio: number | null;
  /** 填充的起点色。 */
  from: string;
  /** 填充的终点色。 */
  to: string;
  className?: string;
}

/**
 * 计量条 —— **永远朝「稀有」那一端填充**。
 *
 * 本产品没有任何进度条往 0 走。「死亡倒计时」式视觉被明确禁止：一条正在
 * 耗尽的进度条会被读成「这个仓库正在死去」，而这个产品只陈述事实。
 *
 * 条本身是装饰性的，数值由旁边的文字承担，所以对辅助技术隐藏。
 */
export function HudMeter({ ratio, from, to, className }: HudMeterProps) {
  if (ratio === null) {
    return <div aria-hidden="true" className={cx("meter", className)} />;
  }

  const width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;

  return (
    <div
      aria-hidden="true"
      className={cx("meter", className)}
      style={{ "--meter-from": from, "--meter-to": to } as CSSProperties}
    >
      <div className="meter__fill" style={{ width }} />
    </div>
  );
}
