import type { ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export interface ToastProps {
  children: ReactNode;
  /** 吐司关掉之后回到哪里。 */
  action?: ReactNode;
  className?: string;
}

/**
 * 吐司 —— 只用于「刚刚做完了」这类瞬时确认。
 *
 * 失败永远不用吐司：错误必须是内联的、带重试的，因为吐司会消失。
 */
export function Toast({ children, action, className }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "animate-toast-rise fixed bottom-6 left-1/2 z-[var(--z-toast)] w-[min(92vw,28rem)] -translate-x-1/2",
        "cut-frame [--frame-fill:var(--color-surface-overlay)] [--frame-edge:var(--color-gold-soft)]",
        className,
      )}
    >
      <div className="cut-frame__inner flex items-center justify-between gap-4 px-5 py-3">
        <span className="text-sm text-fg-primary">{children}</span>
        {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
