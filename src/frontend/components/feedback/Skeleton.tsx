import { cx } from "@/frontend/lib/cx";

export type SkeletonVariant = "card" | "row" | "block";

export interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

/**
 * 骨架屏。
 *
 * 尺寸必须与真实布局一致，否则内容落位时会跳。
 * **绝不显示假的数字** —— 骨架里出现「1,024」会被读成真实结果。
 */
export function Skeleton({ variant = "block", className }: SkeletonProps) {
  if (variant === "card") {
    return (
      <div
        aria-hidden="true"
        className={cx(
          "cut-frame motion-panel-enter [--frame-fill:var(--color-surface-panel)]",
          className,
        )}
      >
        <div className="cut-frame__inner flex flex-col gap-3 p-5">
          <div className="h-10 w-10 animate-pulse rounded-sm bg-surface-inset" />
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-surface-inset" />
          <div className="h-2 w-full animate-pulse rounded-sm bg-surface-inset" />
          <div className="h-2 w-4/5 animate-pulse rounded-sm bg-surface-inset" />
        </div>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div
        aria-hidden="true"
        className={cx("flex items-center gap-3 px-5 py-3", className)}
      >
        <div className="h-8 w-8 animate-pulse rounded-sm bg-surface-inset" />
        <div className="h-3 w-1/3 animate-pulse rounded-sm bg-surface-inset" />
        <div className="h-3 flex-1 animate-pulse rounded-sm bg-surface-inset" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cx("h-4 w-full animate-pulse rounded-sm bg-surface-inset", className)}
    />
  );
}
