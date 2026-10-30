import { useMemo } from "react";
import type {
  Envelope,
  ErrorEnvelope,
  InspectPayload,
  RepoSummary,
} from "@/shared/contract";
import {
  tierCopy,
  tierLabel,
  tierNextStepCopy,
  titleLabel,
} from "@/shared/ids";
import {
  nextTier,
  reposToNextTier,
  tierChargeRatio,
  tierFor,
} from "@/shared/tier";
import { Banner } from "@/frontend/components/chrome/Banner";
import { Button } from "@/frontend/components/common/Button";
import { AchievementShelf } from "@/frontend/components/achievements/AchievementShelf";
import { RepoCard } from "@/frontend/components/card/RepoCard";
import { Sigil } from "@/frontend/components/card/Sigil";
import { ErrorNotice } from "@/frontend/components/feedback/ErrorNotice";
import { UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { HudMeter } from "@/frontend/components/hud/HudMeter";
import { HudRow } from "@/frontend/components/hud/HudRow";
import { TierMark } from "@/frontend/components/hud/TierMark";
import { Panel } from "@/frontend/components/panel/Panel";
import { PanelHeader } from "@/frontend/components/panel/PanelHeader";
import { NameplateBanner } from "@/frontend/components/panel/NameplateBanner";
import { SharePanel } from "@/frontend/components/share/SharePanel";
import { formatCount, formatDuration } from "@/shared/format";
import { errorMessage } from "@/frontend/i18n/errorMessage";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { ageHours, isStale } from "@/frontend/lib/freshness";
import type { ShareCardInput } from "@/frontend/lib/shareCard";

export interface DashboardLayoutProps {
  envelope: Envelope<InspectPayload> | ErrorEnvelope;
  onRetry?: () => void;
  onOpenRepos?: () => void;
}

/**
 * L1 · Dashboard —— Dota 2 主界面。
 *
 * 左边是「英雄面板」：称号、印记、四个统计。右边是「侧栏」：代表仓库、
 * 不完整提示、分享入口。数据从左往右读，视线先落在人（印记）上，再落到
 * 数字上。
 *
 * 所有文案经 `t()` 取当前语言；服务端已经本地化过的载荷（称号名、证据句）
 * 原样渲染，不再二次翻译。
 */
export function DashboardLayout({
  envelope,
  onRetry,
  onOpenRepos,
}: DashboardLayoutProps) {
  const { t, locale } = useI18n();

  /* 分享卡的输入按引用记忆：`SharePanel` 在这张对象变化时才重画一次图，
     每次渲染都给一个新对象会让它一直重画。放在早退之前，hook 顺序才不变。
     语言也在依赖里：称号名与「? 未知」都跟着语言走，换语言就要重画。 */
  const cardInput = useMemo<ShareCardInput | null>(() => {
    if (!envelope.data) return null;
    return {
      login: envelope.data.account.login,
      titleName: titleLabel(envelope.data.title.id, locale).name,
      tier: tierFor(envelope.data.enrolledCount),
      enrolledCount: envelope.data.enrolledCount,
      longestDormantDays: envelope.data.stats.longestDormantDays,
      /* 成功信封一定带 `readAt`；空串只是类型上的兜底，卡片会把它写成「? 未知」，
         不会写一个假日期。 */
      readAt: envelope.readAt ?? "",
    };
  }, [envelope, locale]);

  const { data, completeness, missingPages, readAt } = envelope;

  if (!data) {
    /* 失败时**一个数字都不渲染** —— 尤其是 0。服务端的 `error.message` 是
       简体中文原句，也就是词典的 msgid，所以经 `errorMessage()` 取其译文；
       没有可用的错误对象时用本地兜底句，同样是一句 msgid。 */
    const message =
      ("error" in envelope ? errorMessage(envelope.error, locale) : null) ??
      t("这次没能读到结果。数据还在，你可以稍后再试。");
    return (
      <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
        <ErrorNotice message={message} onRetry={onRetry} />
      </div>
    );
  }

  const { account, stats, title, representatives } = data;

  /* 陈旧天数用共享的 `formatDuration()` 取词，单位才会跟着语言走；
     `staleAgeLabel()` 把「天」写死在字符串里，只适合简体中文。
     判定本身仍来自 `freshness`：超过 `THRESHOLDS.staleAfterHours` 才陈旧。 */
  const staleHours = ageHours(readAt);
  const staleDays =
    isStale(readAt) && staleHours !== null ? Math.ceil(staleHours / 24) : null;
  const staleAge = staleDays === null ? null : formatDuration(staleDays, locale);
  const staleTitle =
    staleAge === null ? null : t("这是 {ago} 前的数据", { ago: staleAge });

  /* 页码之间的分隔符跟着语言走（英语用逗号），它不是一句文案，是连接语法。 */
  const pageList = missingPages.join(locale === "en" ? ", " : "、");

  const reps: Array<[string, RepoSummary | null]> = [
    [t("沉睡最久"), representatives.longestDormant],
    [t("余烬最亮"), representatives.brightestEmber],
    [t("远行的 Fork"), representatives.travelledFork],
  ];

  /* 灵龛充能等级：数量是事实，等级由它派生（`src/shared/tier.ts`）。
     数量未知时等级也是未知 —— 绝不退化成「未启封」，也绝不画一条空的条。 */
  const enrolled = data.enrolledCount;
  const tier = tierFor(enrolled);
  const chargeRatio = tierChargeRatio(enrolled);
  const reposLeft = reposToNextTier(enrolled);
  const next = tier === null ? null : nextTier(tier);
  const tierLabels = tierCopy(locale);

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      {completeness === "partial" ? (
        <Banner
          tone="incomplete"
          title={t("本次结果可能不完整")}
          className="mb-6"
          action={
            onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {t("重新读取")}
              </Button>
            ) : null
          }
        >
          {t("只读取到了前 {n} 个仓库，", { n: data.repos.length })}
          {locale === "en" ? " " : ""}
          {missingPages.length > 0
            ? t("第 {n} 页没有读到。", { n: pageList })
            : t("还有一部分没有读到。")}
        </Banner>
      ) : null}

      {/* 陈旧 ≠ 错误：内容不清空，只补一条常驻说明（§5.4）。 */}
      {staleTitle ? (
        <Banner
          tone="stale"
          title={staleTitle}
          className="mb-6"
          action={
            onRetry ? (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {t("重新读取")}
              </Button>
            ) : null
          }
        >
          {t("数据仍然真实，只是可能已经过时。")}
        </Banner>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- 英雄面板 */}
        <Panel
          variant="panel"
          edge="gold"
          cut="lg"
          grain
          bevel
          brackets
          className="motion-panel-enter self-start"
          as="section"
          aria-label={t("{login} 的灵龛鉴定", { login: account.login })}
        >
          <div className="cut-frame__inner flex flex-col gap-6 p-6">
            <NameplateBanner mark="◈" className="self-start">
              {title.name}
            </NameplateBanner>

            <div className="flex items-center gap-4">
              <span className="flex flex-none items-center justify-center rounded-sm border border-gold-soft bg-surface-inset p-3">
                <Sigil name={account.login} size={64} breathe />
              </span>
              <div className="min-w-0">
                {/* 这一页的 h1。视觉系统 §10：每页一个 h1，其后不跳级。
                    tabindex="-1"：路由切换后焦点要落在这里（交互规范 §8.3）。 */}
                <h1
                  tabIndex={-1}
                  className="font-mono text-lg font-normal text-fg-primary"
                >
                  @{account.login}
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                  {titleLabel(title.id, locale).description}
                </p>
              </div>
            </div>

            {/* 灵龛充能等级 —— 用户侧的阶梯。量的是「带主题的公开仓库数」，
                与稀有度阶梯（量仓库的沉睡时长）是两条不同的轴。
                位置：称号卡与统计格之间（交互规范 §3 M2.2 #14、视觉系统 §8.1）。 */}
            <section
              aria-label={tierLabels.label}
              className="flex flex-col gap-2 border-t border-hairline-soft pt-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="display-cn text-2xs tracking-wide text-fg-muted">
                  {tierLabels.label}
                </p>
                {tier === null ? (
                  <UnknownValue label={tierLabels.label} />
                ) : (
                  <TierMark tier={tier} />
                )}
              </div>

              <p className="text-2xs leading-relaxed text-fg-muted">
                {tier === null
                  ? tierLabels.unknown
                  : tierLabel(tier, locale).description}
              </p>

              {/* 条量的是当前档的顶，所以任何 Ⅰ 阶及以上的档位都有一条不为空的
                  条。未启封没有东西可填，最高阶没有下一档 —— 两者都不画条。 */}
              {chargeRatio !== null ? (
                /* 充能条走计量条的基础渐变（青 → 金），**刻意不等于任何一条
                   稀有度渐变** —— 传说档的条也是金色渐变，两条同时出现在
                   Dashboard 上时，不能让人把「这个人攒了 7 个仓库」读成
                   「这个仓库沉了三年」。两根轴不共用颜色（视觉系统 §4.4）。 */
                <HudMeter
                  ratio={chargeRatio}
                  from="var(--color-teal)"
                  to="var(--color-gold)"
                />
              ) : null}

              {/* 剩下的距离由文字承担 —— 条量的是当前档，说不出还差几个。 */}
              {reposLeft !== null && next !== null ? (
                <p className="text-2xs text-fg-muted">
                  {tierNextStepCopy(reposLeft, next, locale)}
                </p>
              ) : null}
            </section>

            <dl className="flex flex-col gap-1.5 border-t border-hairline-soft pt-4">
              <HudRow
                label={t("最长沉睡")}
                value={
                  stats.longestDormantDays === null ? (
                    <UnknownValue label={t("最长沉睡天数")} />
                  ) : (
                    formatDuration(stats.longestDormantDays, locale)
                  )
                }
              />
              <HudRow
                label={t("仍有余烬")}
                value={
                  stats.emberCount === null ? (
                    <UnknownValue label={t("余烬仓库数")} />
                  ) : (
                    formatCount(stats.emberCount, locale)
                  )
                }
              />
              <HudRow
                label={t("公开 Fork")}
                value={
                  stats.forkCount === null ? (
                    <UnknownValue label={t("Fork 数量")} />
                  ) : (
                    formatCount(stats.forkCount, locale)
                  )
                }
              />
              <HudRow
                label={t("已归档")}
                value={
                  stats.archivedCount === null ? (
                    <UnknownValue label={t("已归档数量")} />
                  ) : (
                    formatCount(stats.archivedCount, locale)
                  )
                }
              />
              <HudRow
                label={t("公开仓库")}
                value={
                  data.repoCount === null ? (
                    <UnknownValue label={t("仓库数量")} />
                  ) : (
                    formatCount(data.repoCount, locale)
                  )
                }
              />
            </dl>

            {title.evidence.length > 0 ? (
              <ul className="flex flex-col gap-1 border-t border-hairline-soft pt-4">
                {title.evidence.map((e) => (
                  <li key={e.text} className="text-2xs leading-relaxed text-fg-muted">
                    · {e.text}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={onOpenRepos}>
                {t("查看我的仓库")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const panel = document.getElementById("share-panel");
                  if (!panel) return;
                  /* 减少动态效果时不要一段平滑滚动 —— 那不是装饰，是一段
                     用户明确要求去掉的位移。 */
                  const reduce = window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches;
                  panel.scrollIntoView({
                    behavior: reduce ? "auto" : "smooth",
                    block: "center",
                  });
                  /* 焦点跟着走：键盘与读屏用户点完之后，下一个 Tab 应该从
                     分享面板开始，而不是还留在侧栏顶端。 */
                  panel.focus({ preventScroll: true });
                }}
              >
                {t("去分享")}
              </Button>
            </div>
          </div>
        </Panel>

        {/* ---------------------------------------------------------- 侧栏 */}
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            variant="panel"
            cut="md"
            grain
            as="section"
            aria-labelledby="reps-heading"
            className="motion-panel-enter"
          >
            <PanelHeader
              id="reps-heading"
              title={t("三个代表")}
              subtitle={t("按沉睡时长、余烬亮度与 Fork 旅程各选一个")}
            />
            <div className="cut-frame__inner flex flex-col gap-4 p-6">
              {reps.map(([label, repo]) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <p className="display-cn text-2xs tracking-wide text-fg-muted">{label}</p>
                  {repo ? (
                    <RepoCard repo={repo} readAt={readAt} size="feature" />
                  ) : (
                    <p className="rounded-sm border border-hairline-soft bg-surface-inset px-4 py-3 text-xs text-fg-secondary">
                      {t("暂时没有找到这一类仓库。")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <AchievementShelf enrolledCount={data.enrolledCount} />

          <SharePanel
            login={account.login}
            tier={tier}
            enrolledCount={enrolled}
            card={cardInput}
          />
        </div>
      </div>
    </div>
  );
}
