import type { CSSProperties } from "react";
import type { RepoSummary } from "@/shared/contract";
import { rarityLabel, tagLabel } from "@/shared/ids";
import { RarityRibbon } from "@/frontend/components/card/RarityRibbon";
import { Sigil } from "@/frontend/components/card/Sigil";
import { TagChip } from "@/frontend/components/common/TagChip";
import { UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { HudMeter } from "@/frontend/components/hud/HudMeter";
import { StatCell } from "@/frontend/components/hud/StatCell";
import { formatDuration, formatRelativeTime, formatLanguage } from "@/shared/format";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { isStale } from "@/frontend/lib/freshness";
import {
  rarityEdgeVar,
  rarityFillVar,
  rarityGlowVar,
  rarityMeterRatio,
  rarityMeterVars,
  rarityOf,
} from "@/frontend/lib/rarity";
import { cx } from "@/frontend/lib/cx";

export interface RepoCardProps {
  repo: RepoSummary;
  /** 本次读取的时间。卡片上每个数字都要带着它。 */
  readAt: string | null;
  /** 网格里的小卡 / 侧栏的大卡。 */
  size?: "grid" | "feature";
  onSelect?: (repo: RepoSummary) => void;
  className?: string;
}

const MAX_VISIBLE_TAGS = 3;

/**
 * 仓库卡 —— Dota「宝物格」的对应物。
 *
 * 卡上只有事实：名字、简介、沉睡天数、Star、Fork、语言、状态标签、读取时间。
 * 没有评价，没有分数，没有「这个项目失败了」。
 */
export function RepoCard({
  repo,
  readAt,
  size = "grid",
  onSelect,
  className,
}: RepoCardProps) {
  const { t, locale } = useI18n();
  const rarity = rarityOf(repo.dormantDays);
  const ratio = rarityMeterRatio(repo.dormantDays);
  const meter = rarity ? rarityMeterVars(rarity) : null;
  const days = formatDuration(repo.dormantDays, locale);
  const language = formatLanguage(repo.language);
  /* §5.4：新鲜用次级色，陈旧转弱化色。内容不变 —— 只是说清楚它有多旧。 */
  const stale = isStale(readAt);
  const visibleTags = repo.tags.slice(0, MAX_VISIBLE_TAGS);
  const hiddenTags = repo.tags.slice(MAX_VISIBLE_TAGS);
  const hiddenTagCount = repo.tags.length - visibleTags.length;
  const feature = size === "feature";

  const body = (
    <>
      {/* 窄卡上标题、印记、缎带三者抢一行，标题会被压到只剩几个字符
          （320px 时测到 46px，`alice/time-capsule-lab` 只剩 `a…`）。
          所以这一行允许换行，并给标题块一个 10rem 的基准宽度：放不下时
          缎带落到下一行、靠右，标题独占整行。 */}
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex flex-none items-center justify-center rounded-sm border border-hairline-soft bg-surface-inset p-1.5">
          <Sigil name={repo.fullName} size={feature ? 40 : 32} />
        </span>

        <div className="min-w-0 flex-[1_1_10rem]">
          {/* `owner/repo` 是用户数据，可以截断 —— 但要在两行之内截，
              且允许在斜杠后换行。主人弱化、仓库名突出。 */}
          <h3
            title={repo.fullName}
            className="line-clamp-2 break-words font-mono text-sm font-medium text-fg-primary"
          >
            <span className="text-fg-muted">{repo.owner}/</span>
            {repo.name}
          </h3>
          {repo.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-secondary">
              {repo.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-fg-muted">{t("这个仓库没有写简介。")}</p>
          )}
        </div>

        {rarity ? (
          <RarityRibbon rarity={rarity} className="ml-auto flex-none" />
        ) : null}
      </div>

      {/* 计量条永远朝「稀有」那一端填充，绝不往 0 走。 */}
      <div className="mt-4">
        <HudMeter
          ratio={ratio}
          from={meter?.from ?? "var(--color-hairline)"}
          to={meter?.to ?? "var(--color-hairline)"}
          className="w-full"
        />
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="tnum text-xl font-semibold text-data-emphasis">
            {days ?? <UnknownValue label={t("沉睡天数")} />}
          </span>
          {/* 稀有度说明只在宽卡上出现。窄卡里它会把数字挤到换行。 */}
          {rarity && feature ? (
            <span className="text-2xs text-fg-muted">
              {rarityLabel(rarity, locale).description}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatCell
          icon={<StarIcon />}
          value={
            repo.starCount === null ? <UnknownValue label={t("Star 数")} /> : repo.starCount
          }
        />
        <StatCell
          icon={<ForkIcon />}
          value={
            repo.forkCount === null ? <UnknownValue label={t("Fork 数")} /> : repo.forkCount
          }
        />
        {language ? (
          <span className="text-2xs text-fg-muted">{language}</span>
        ) : (
          <span className="text-2xs text-fg-muted">{t("未标注语言")}</span>
        )}
      </div>

      {repo.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {visibleTags.map((tag) => (
            <TagChip key={tag} id={tag} />
          ))}
          {hiddenTagCount > 0 ? (
            <span
              className="text-2xs text-fg-muted"
              title={t("还有 {n} 个标签：{names}", {
                n: hiddenTagCount,
                /* 折叠的标签也用译名，而不是把胶囊 id 直接摊给用户看。 */
                names: hiddenTags
                  .map((tag) => tagLabel(tag, locale).label)
                  .join(locale === "en" ? ", " : "、"),
              })}
            >
              +{hiddenTagCount}
            </span>
          ) : null}
        </div>
      ) : null}

      <p
        className={cx(
          "mt-4 text-2xs",
          stale ? "text-fg-muted" : "text-fg-secondary",
        )}
      >
        {/* 有读取时间时是一整句 —— 「Read at 2 days ago」在英语里读不通，
            时间的位置随语言走。没有时间时才退回「标签 + 未知」的拼法：
            那个位置要给 `UnknownValue` 自己的样式。 */}
        {readAt ? (
          t("读取于 {time}", { time: formatRelativeTime(readAt, locale) ?? readAt })
        ) : (
          <>
            {t("读取于")} <UnknownValue label={t("读取时间")} />
          </>
        )}
      </p>
    </>
  );

  /* 入场动画由**容器**承担：网格项自己带交错延迟，面板自己带面板入场。
     卡片再淡一次会把两段透明度乘在一起 —— 交错就糊了。 */
  const shell = cx(
    "cut-frame motion-card-hover relative",
    rarity ? "[--frame-edge:var(--rarity-edge,var(--color-hairline))]" : "",
    className,
  );

  /* 稀有度的变量写在**卡**上，不是缎带上。
     CSS 变量只往下继承：写在缎带上的 `--rarity-edge` 到不了外层的描边，
     描边会一直停在默认的细灰线 —— 那一档的等级就只剩缎带一处说明了。 */
  const shellStyle = rarity
    ? ({
        "--rarity-edge": rarityEdgeVar(rarity),
        "--rarity-fill": rarityFillVar(rarity),
        "--rarity-glow": rarityGlowVar(rarity),
      } as CSSProperties)
    : undefined;

  /* 传说多一圈卡外的金色辉光。稀有与史诗是卡内的内发光，画在 .cut-frame__inner 上。 */
  const innerClass = cx(
    "cut-frame__inner grain p-5",
    feature ? "p-6" : "",
    rarity === "legendary" ? "cut-frame__inner--bloom" : "",
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(repo)}
        className={cx(
          shell,
          "block w-full cursor-pointer text-left",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        )}
        style={shellStyle}
      >
        <div className={innerClass}>{body}</div>
      </button>
    );
  }

  return (
    <article className={shell} style={shellStyle}>
      <div className={innerClass}>{body}</div>
    </article>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8 6.7 19.6l1.1-5.8L3.5 9.7l5.9-.8z" />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6.5" cy="5" r="2.5" />
      <circle cx="6.5" cy="19" r="2.5" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M6.5 7.5v9M6.5 12h6a5 5 0 0 0 5-3" />
    </svg>
  );
}
