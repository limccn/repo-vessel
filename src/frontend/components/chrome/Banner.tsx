import type { ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export type BannerTone = "incomplete" | "stale" | "info";

export interface BannerProps {
  tone?: BannerTone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const TONE: Record<BannerTone, string> = {
  // 琥珀 = 需要你注意或行动（限流、结果不完整）
  incomplete: "border-alert-warn/45",
  // 陈旧 = 「这是 X 天前的数据」。它需要被看见，但不需要被当成警告。
  stale: "border-hairline",
  info: "border-hairline",
};

/**
 * 常驻提示条。
 *
 * 不完整、陈旧、限流都属于「有话要说」，所以是常驻条，不是吐司。
 * 吐司会消失，而这几条消息消失之后用户就不知道自己看到的是不是全的。
 */
export function Banner({
  tone = "info",
  title,
  children,
  action,
  className,
}: BannerProps) {
  return (
    <div
      role="status"
      className={cx(
        "flex flex-col gap-2 rounded-sm border bg-surface-inset px-5 py-4",
        TONE[tone],
        className,
      )}
    >
      <p
        className={cx(
          "text-sm font-semibold",
          tone === "incomplete" ? "text-alert-warn" : "text-fg-primary",
        )}
      >
        {title}
      </p>
      {children ? (
        <div className="text-xs leading-relaxed text-fg-secondary">{children}</div>
      ) : null}
      {action ? <div className="mt-1 flex items-center gap-3">{action}</div> : null}
    </div>
  );
}
