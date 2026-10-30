import type { ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * 空状态 —— 正常的结局，不是错误。
 *
 * 它绝不使用错误色，也绝不使用警示色。空就是空。
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <p className="display-cn text-lg text-fg-primary">{title}</p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-fg-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
