/**
 * 三态字段的构造与渲染。
 *
 * 「有值 / 未知 / 不适用」是三种不同的事实，类型把它们分开，组件把它们分开渲染。
 * 未知永远是 `? 未知`（灰 + 虚线下划线 + `?`），绝不退化成 0、空串或「—」。
 *
 * 三态本身就是文案：`? 未知`、`不适用`、以及读屏用的整句说明都要跟着语言走。
 * 字段名由调用方传入 —— 调用方负责先把它译好（`t("沉睡天数")`），本组件只把
 * 它嵌进整句，所以语序随译文的 `{label}` 走，而不是由中文语序拼出来。
 */

import type { FieldState, UnknownReason } from "@/shared/contract";
import { unknownReasonLabel } from "@/shared/ids";
import { useI18n } from "@/frontend/i18n/LocaleProvider";

export interface UnknownValueProps {
  reason?: UnknownReason;
  /** 字段名（已本地化），进入无障碍名称。 */
  label?: string;
}

/**
 * 未知值本身。灰、虚线下划线、`?`。
 *
 * 原因不能只挂在 `aria-label` 上：这个 `?` 出现在**按钮**里面（仓库卡整张
 * 就是一个 `<button>`），而按钮里不能再放按钮 —— 嵌套的可交互元素是无效
 * HTML，屏幕阅读器也会跳过它。所以「? 未知」是一个纯文本标记，原因用
 * 视觉隐藏的真实文本承载：读屏读到的是「沉睡天数未知：GitHub 没有提供这个值」。
 */
export function UnknownValue({ reason = "not-provided", label }: UnknownValueProps) {
  const { t, locale } = useI18n();
  const name = label ?? t("这个值");
  const explanation = unknownReasonLabel(reason, locale);
  return (
    <span className="value-unknown" title={explanation}>
      <span aria-hidden="true">{t("? 未知")}</span>
      <span className="sr-only">
        {t("{label}未知：{reason}", { label: name, reason: explanation })}
      </span>
    </span>
  );
}

export interface FieldValueProps {
  state: FieldState;
  className?: string;
  /** 字段名（已本地化），进入无障碍名称。 */
  label?: string;
}

/** 三态字段的统一渲染口。 */
export function FieldValue({ state, className, label }: FieldValueProps) {
  const { t } = useI18n();

  if (state.kind === "value") {
    return <span className={className}>{state.value}</span>;
  }
  if (state.kind === "na") {
    const name = label ?? t("这个字段");
    return (
      <span className={className ?? "text-fg-muted"} title={t("这个字段在当前语境下没有意义")}>
        <span aria-hidden="true">{t("不适用")}</span>
        <span className="sr-only">
          {t("{label}在当前语境下没有意义", { label: name })}
        </span>
      </span>
    );
  }
  return <UnknownValue reason={state.reason} label={label} />;
}
