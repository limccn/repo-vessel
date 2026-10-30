import {
  ACHIEVEMENTS,
  achievementBadgeAlt,
  achievementCopy,
  achievementRemaining,
  achievementRemainingCopy,
  achievementRequirement,
} from "@/shared/achievements";
import { UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { Panel } from "@/frontend/components/panel/Panel";
import { PanelHeader } from "@/frontend/components/panel/PanelHeader";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { cx } from "@/frontend/lib/cx";

export interface AchievementShelfProps {
  /** 带主题的公开仓库数。`null` / `undefined` = 未知。 */
  enrolledCount: number | null | undefined;
}

/**
 * 成就徽章架。
 *
 * 三态与其余产品一致：
 *
 * - 已达成：徽章原图 + 「下载徽章」。
 * - 未达成：同一张图压暗，条件由文字承担，并说出还差几个仓库。
 * - 未知：`? 未知` —— 不把「读不到」说成「一枚都没有」。
 *
 * 徽章是位图资产，不参与 `audit:design` 的令牌扫描；面板本身只用既有令牌。
 * 徽章上的拉丁名（Urn of Repos / Repo Vessel）是刻在图上的名字，不翻译；
 * 它周围的每一个词 —— 条件、差几个、下载 —— 都跟着界面语言走。
 */
export function AchievementShelf({ enrolledCount }: AchievementShelfProps) {
  const { t, locale } = useI18n();
  const copy = achievementCopy(locale);
  const unknown = enrolledCount == null;

  return (
    <Panel
      variant="panel"
      cut="md"
      grain
      as="section"
      aria-labelledby="achievements-heading"
      className="motion-panel-enter"
    >
      <PanelHeader
        id="achievements-heading"
        title={copy.label}
        subtitle={t("达成即颁发，可以下载，也可以分享")}
      />
      <div className="cut-frame__inner flex flex-col gap-4 p-6">
        {unknown ? (
          <p className="text-xs leading-relaxed text-fg-secondary">
            <UnknownValue label={copy.label} />
            {" "}
            {copy.unknown}
          </p>
        ) : null}

        <ul className="flex flex-col gap-4">
          {ACHIEVEMENTS.map((def) => {
            const remaining = achievementRemaining(enrolledCount, def);
            const earned = remaining === 0;

            return (
              <li key={def.id} className="flex items-start gap-3">
                <img
                  src={def.thumbSrc}
                  srcSet={def.thumbSrcSet}
                  sizes="64px"
                  alt={earned ? achievementBadgeAlt(def, locale) : ""}
                  aria-hidden={earned ? undefined : true}
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className={cx(
                    "h-16 w-16 flex-none rounded-sm border border-hairline object-cover",
                    earned ? "opacity-100" : "opacity-35 grayscale",
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-sm text-fg-primary">{def.name}</p>
                  <p className="text-2xs leading-relaxed text-fg-muted">
                    {achievementRequirement(def, locale)}
                  </p>
                  {earned ? (
                    <a
                      href={def.badgeSrc}
                      download={def.downloadName}
                      className="inline-flex min-h-6 items-center self-start text-2xs text-teal underline decoration-teal/30"
                    >
                      {copy.download}
                    </a>
                  ) : remaining !== null ? (
                    <p className="text-2xs text-fg-secondary">
                      {achievementRemainingCopy(remaining, locale)}
                    </p>
                  ) : (
                    <UnknownValue label={copy.label} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
