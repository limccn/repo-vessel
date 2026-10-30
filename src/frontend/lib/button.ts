import { cx } from "@/frontend/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border border-gold bg-gold text-on-accent hover:border-gold-bright hover:bg-gold-bright",
  secondary:
    "border border-hairline bg-transparent text-fg-primary hover:border-gold-soft hover:text-gold-bright",
  ghost:
    "border border-hairline-soft bg-transparent text-fg-secondary hover:border-gold-soft hover:text-gold-bright",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/**
 * 按钮的类名。
 *
 * 放在 `lib/` 而不是 `Button.tsx`：一个组件文件只导出组件，才能让
 * react-refresh 正常工作。分享到 Twitter 是一个真实的 `<a>`（可以复制
 * 链接、可以新窗口打开），但它必须看起来与按钮一模一样 —— 两处共用这一份
 * 类名，样式就不会走散。
 */
export function buttonClassName(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-sm font-medium",
    "transition-colors duration-[var(--motion-duration-fast)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}
