import type { CSSProperties } from "react";
import { rarityLabel, type RarityId } from "@/shared/ids";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { rarityEdgeVar, rarityFillVar } from "@/frontend/lib/rarity";
import { cx } from "@/frontend/lib/cx";

export interface RarityRibbonProps {
  rarity: RarityId;
  className?: string;
}

/**
 * 稀有度缎带 —— 卡片的等级标识。
 *
 * 等级词**永远**与颜色一起出现。颜色只是冗余编码，去掉颜色这段文字依然
 * 完整可读 —— 这是「未知 ≠ 0」同一条原则在视觉上的延伸。
 */
export function RarityRibbon({ rarity, className }: RarityRibbonProps) {
  const { locale } = useI18n();
  const label = rarityLabel(rarity, locale);
  const legendary = rarity === "legendary";

  return (
    <span
      className={cx("rarity-ribbon", className)}
      style={
        {
          "--rarity-edge": rarityEdgeVar(rarity),
          "--rarity-fill": rarityFillVar(rarity),
        } as CSSProperties
      }
    >
      <span
        className="display-cn text-2xs"
        style={{ color: label.color }}
      >
        {label.label}
      </span>
      {legendary ? (
        <span
          aria-hidden="true"
          className="rarity-ribbon__sweep motion-ribbon-shimmer animate-ribbon-shimmer"
        />
      ) : null}
    </span>
  );
}
