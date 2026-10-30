import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "@/frontend/lib/button";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 载入中。按钮保持原宽度，文案换成「处理中…」。 */
  loading?: boolean;
  children: ReactNode;
}

/**
 * 按钮。
 *
 * 禁用态是 opacity .45 + cursor: not-allowed，并且**始终保留 1px 描边** ——
 * 一块没有描边的灰块会被误读成「未知」，而未知在本站有专门的写法。
 *
 * 需要「长得像按钮的链接」时用 `buttonClassName()`（`lib/button.ts`）。
 */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const { t } = useI18n();
  const isDisabled = disabled === true || loading;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={buttonClassName(variant, size, className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
        />
      ) : null}
      <span>{loading ? t("处理中…") : children}</span>
    </button>
  );
}
