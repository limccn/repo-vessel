import type { CSSProperties } from "react";
import { tagLabel, type TagId } from "@/shared/ids";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { cx } from "@/frontend/lib/cx";

export interface TagChipProps {
  id: TagId;
  /** 存在时渲染为可点击的筛选芯片。 */
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/**
 * 状态标签芯片。
 *
 * 颜色是冗余编码 —— 文字永远在。禁用态不是灰色遮罩，而是 opacity .45，
 * 并且始终保留 1px 描边，避免与「未知」混淆。
 */
export function TagChip({ id, onClick, selected = false, className }: TagChipProps) {
  const { locale } = useI18n();
  const tag = tagLabel(id, locale);
  const style = { "--chip-color": tag.color } as CSSProperties;

  const content = (
    <>
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      <span>{tag.label}</span>
    </>
  );

  const shell = cx(
    "inline-flex items-center gap-1.5 rounded-pill border px-2.5 text-2xs",
    "border-hairline-soft bg-surface-inset text-fg-secondary",
    "transition-colors duration-[var(--motion-duration-fast)]",
    /* 可点的芯片是筛选控件，手指得点得中：22px 高不够，加到 ~30px。
       卡上的静态标签没有这个问题，保持紧凑。 */
    onClick ? "cursor-pointer py-1.5" : "py-0.5",
    onClick &&
      "hover:border-gold-soft hover:text-fg-primary focus-visible:outline-2",
    selected && "border-gold-soft text-fg-primary",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={shell} title={tag.explanation} style={style}>
        {content}
      </button>
    );
  }

  return (
    <span className={shell} title={tag.explanation} style={style}>
      {content}
    </span>
  );
}
