import type { ReactNode } from "react";
import { Button } from "@/frontend/components/common/Button";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { cx } from "@/frontend/lib/cx";

export interface ErrorNoticeProps {
  /**
   * 错误文案。**由调用方给成已经翻译过的一句**（后端下发的 `message` 是词典
   * 的 msgid，`errorMessage()` 会先查表）；这里原样渲染，不再查第二次。
   */
  message: string;
  /** 补充说明，比如下架申请入口。 */
  hint?: ReactNode;
  onRetry?: () => void;
  /** 按钮文案。默认「重试」，按当前语言查表。 */
  retryLabel?: string;
  className?: string;
}

/**
 * 内联错误 + 重试。
 *
 * 硬错误才用 `--color-alert-stop`，它是全站唯一的红色。错误永远是内联的、
 * 带重试的，不是一闪而过的吐司。
 */
export function ErrorNotice({
  message,
  hint,
  onRetry,
  retryLabel,
  className,
}: ErrorNoticeProps) {
  // 默认值不能用参数默认值 —— 那在 React 之外求值，读不到当前语言。
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-col gap-3 rounded-sm border border-alert-stop/45 bg-surface-inset px-5 py-4",
        className,
      )}
    >
      <p className="text-sm leading-relaxed text-fg-primary">{message}</p>
      <div className="flex flex-wrap items-center gap-3">
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            {retryLabel ?? t("重试")}
          </Button>
        ) : null}
        {hint ? <div className="text-xs text-fg-muted">{hint}</div> : null}
      </div>
    </div>
  );
}
