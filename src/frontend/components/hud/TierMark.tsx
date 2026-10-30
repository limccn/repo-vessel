import { tierAccessibleName, tierLabel, type TierId } from "@/shared/ids";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { cx } from "@/frontend/lib/cx";

export interface TierMarkProps {
  tier: TierId;
  /** 星标的排布尺寸。 */
  size?: "sm" | "md";
  className?: string;
}

/**
 * 灵龛充能等级标记 —— 罗马数字 + 阶 + 星标。
 *
 * 两条规则，都是硬规则：
 *
 * 1. **等级绝不由颜色单独承担。** 罗马数字永远可见，星标数量永远与它对得上，
 *    颜色只是冗余编码。哪怕把所有颜色都拿掉，一样能读出等级。
 * 2. **`aria-label` 挂在裸 `<span>` 上会被读屏丢掉** —— 裸 span 的 role 是
 *    `generic`，很多读屏直接跳过它的可及名称。所以可见的数字与后缀是
 *    `aria-hidden`，真正承载含义的是一段**视觉隐藏的真实文本**。这与
 *    `UnknownValue` 是同一个写法。
 *
 * 颜色全部取自既有令牌（`--color-gold` / `--color-gold-bright` /
 * `--color-fg-primary`）：**不引入新令牌，也不碰稀有度阶梯**。充能阶梯量
 * 的是用户，稀有度阶梯量的是仓库，两条不同的轴不该共用颜色。
 */
export function TierMark({ tier, size = "md", className }: TierMarkProps) {
  const { locale } = useI18n();
  const label = tierLabel(tier, locale);
  const compact = size === "sm";

  /* 罗马数字在等级词里的位置随语言变：中文是「Ⅲ 阶」（数字在前），英语是
     「Tier Ⅲ」（数字在后）。所以不拼「数字 + 阶」，而是按数字在整条译文里的
     位置切一刀 —— 数字永远是被强调的那一段，词序跟着译文走。 */
  const at = label.numeral ? label.label.indexOf(label.numeral) : -1;
  const before = at > 0 ? label.label.slice(0, at).trim() : "";
  const after = at >= 0 ? label.label.slice(at + label.numeral.length).trim() : label.suffix;

  return (
    <span className={cx("inline-flex items-baseline gap-1 whitespace-nowrap", className)}>
      <span className="sr-only">{tierAccessibleName(tier, locale)}</span>

      {label.numeral ? (
        <>
          {before ? (
            <span
              aria-hidden="true"
              className={cx("text-fg-secondary", compact ? "text-2xs" : "text-sm")}
            >
              {before}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={cx(
              "font-display",
              compact ? "text-sm" : "text-base",
              /* 最高一档是「装满了」的那一刻，用 `--color-gold-bright` ——
                 但那只是冗余编码，数字与星标才是真正的承载。 */
              tier === "iv" ? "text-gold-bright" : "text-fg-primary",
            )}
          >
            {label.numeral}
          </span>
          {after ? (
            <span
              aria-hidden="true"
              className={cx("text-fg-secondary", compact ? "text-2xs" : "text-sm")}
            >
              {after}
            </span>
          ) : null}
        </>
      ) : (
        <span
          aria-hidden="true"
          className={cx("text-fg-secondary", compact ? "text-2xs" : "text-sm")}
        >
          {label.label}
        </span>
      )}

      {label.stars > 0 ? (
        <span
          aria-hidden="true"
          className={cx("text-gold", compact ? "text-2xs" : "text-sm")}
        >
          {"★".repeat(label.stars)}
        </span>
      ) : null}
    </span>
  );
}
