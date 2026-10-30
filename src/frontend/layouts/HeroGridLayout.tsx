import { useMemo, useState } from "react";
import type {
  Envelope,
  ErrorEnvelope,
  InspectPayload,
  RepoSummary,
  TagId,
} from "@/shared/contract";
import { RARITY_ORDER, TAG_ORDER, rarityLabel, type RarityId } from "@/shared/ids";
import { THRESHOLDS } from "@/shared/thresholds";
import { RepoCard } from "@/frontend/components/card/RepoCard";
import { Sigil } from "@/frontend/components/card/Sigil";
import { Button } from "@/frontend/components/common/Button";
import { Banner } from "@/frontend/components/chrome/Banner";
import { TagChip } from "@/frontend/components/common/TagChip";
import { EmptyState } from "@/frontend/components/feedback/EmptyState";
import { ErrorNotice } from "@/frontend/components/feedback/ErrorNotice";
import { FieldValue, UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { HudRow } from "@/frontend/components/hud/HudRow";
import { Panel } from "@/frontend/components/panel/Panel";
import { PanelHeader } from "@/frontend/components/panel/PanelHeader";
import { errorMessage } from "@/frontend/i18n/errorMessage";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { rarityOf } from "@/frontend/lib/rarity";
import { naField } from "@/frontend/lib/field";
import { formatCount, formatDuration } from "@/shared/format";
import { ageHours, isStale } from "@/frontend/lib/freshness";
import { cx } from "@/frontend/lib/cx";

type SortKey = "dormant" | "pushed" | "stars" | "name";

/**
 * 排序选项。`label` 是**简体中文 msgid**，渲染时才经 `t()` 取译文 ——
 * 模块级常量拿不到当前语言，只有句子本身可以留在这里（与 `ids.ts` 同一套做法）。
 */
const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "dormant", label: "沉睡最久" },
  { id: "pushed", label: "最近推送" },
  { id: "stars", label: "Star 最多" },
  { id: "name", label: "名称" },
];

export interface HeroGridLayoutProps {
  envelope: Envelope<InspectPayload> | ErrorEnvelope;
  /** 重新读取。不完整或陈旧时出现。 */
  onRetry?: () => void;
}

/**
 * L2 · Hero Grid —— Dota 2 英雄选择。
 *
 * 左边是筛选栏，中间是肖像网格，右边是悬停预览。网格里的每张卡就是一件宝物：
 * 印记是肖像，缎带是稀有度，计量条是沉睡时长。
 *
 * 筛选与排序全部在客户端完成，**不产生任何加载态**。
 *
 * 所有文案经 `t()` 取当前语言；服务端已经本地化过的载荷（仓库描述等）
 * 原样渲染，不再二次翻译。
 */
export function HeroGridLayout({ envelope, onRetry }: HeroGridLayoutProps) {
  const { t, locale } = useI18n();
  const repos = useMemo(() => envelope.data?.repos ?? [], [envelope.data]);
  const { completeness, missingPages, readAt } = envelope;

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

  const [rarities, setRarities] = useState<Set<RarityId>>(() => new Set());
  const [tags, setTags] = useState<Set<TagId>>(() => new Set());
  const [dormantOnly, setDormantOnly] = useState(false);
  const [embersOnly, setEmbersOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("dormant");
  const [preview, setPreview] = useState<RepoSummary | null>(null);

  const availableTags = useMemo(() => {
    const seen = new Set<TagId>();
    for (const repo of repos) {
      for (const tag of repo.tags) seen.add(tag);
    }
    return TAG_ORDER.filter((tag) => seen.has(tag));
  }, [repos]);

  const visible = useMemo(() => {
    const filtered = repos.filter((repo) => {
      if (dormantOnly) {
        if (repo.dormantDays === null || repo.dormantDays < THRESHOLDS.quietMinDays) return false;
      }
      if (embersOnly) {
        const isEmber =
          repo.dormantDays !== null &&
          repo.dormantDays >= THRESHOLDS.emberMinDays &&
          repo.starCount !== null &&
          repo.starCount >= THRESHOLDS.emberMinStars;
        if (!isEmber) return false;
      }
      if (rarities.size > 0) {
        const rarity = rarityOf(repo.dormantDays);
        if (rarity === null || !rarities.has(rarity)) return false;
      }
      if (tags.size > 0) {
        for (const tag of tags) {
          if (!repo.tags.includes(tag)) return false;
        }
      }
      return true;
    });

    const sorted = [...filtered];
    switch (sort) {
      case "dormant":
        sorted.sort((a, b) => (b.dormantDays ?? -1) - (a.dormantDays ?? -1));
        break;
      case "pushed":
        sorted.sort(
          (a, b) => Date.parse(b.pushedAt ?? "") - Date.parse(a.pushedAt ?? "") || 0,
        );
        break;
      case "stars":
        sorted.sort((a, b) => (b.starCount ?? -1) - (a.starCount ?? -1));
        break;
      case "name":
        sorted.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
    }
    return sorted;
  }, [repos, rarities, tags, dormantOnly, embersOnly, sort]);

  const toggle = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const filterCount = rarities.size + tags.size + (dormantOnly ? 1 : 0) + (embersOnly ? 1 : 0);

  /* 超过 20 张卡就不逐张入场了 —— 整块一起淡入。
     逐项动画在长列表上既慢又吵，动效规范明确禁止（design-tokens.md「energy budget」）。 */
  const animateItems = visible.length <= 20;

  /* 读不到账户时，列表页也不能显示「0 个仓库」——那是把失败说成空。
     所有 hook 都已在上方调用完，这个提前返回是安全的。 */
  if (!envelope.data) {
    const message =
      ("error" in envelope ? errorMessage(envelope.error, locale) : null) ??
      t("这次没能读到仓库列表。稍后再试。");
    return (
      <div className="mx-auto max-w-wide px-4 py-10 sm:px-6">
        <h1 className="sr-only" tabIndex={-1}>
          {t("仓库列表")}
        </h1>
        <ErrorNotice message={message} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-wide px-4 py-8 sm:px-6">
      {/* 这一页的 h1。可见标题是「全部仓库」，但每页必须有一个 h1，
          且其后不跳级（视觉系统 §10）。它对读屏可见、对视觉隐藏 ——
          构图不动，标题层级补齐。tabindex="-1"：路由切换后焦点落在这里
          （交互规范 §8.3）。 */}
      <h1 className="sr-only" tabIndex={-1}>
        {envelope.data
          ? t("{login} 的仓库列表", { login: envelope.data.account.login })
          : t("仓库列表")}
      </h1>
      {/* 一份列表如果少读了东西却不说，用户会以为那就是全部。 */}
      {completeness === "partial" || staleTitle ? (
        <div className="mb-6 flex flex-col gap-4">
          {completeness === "partial" ? (
            <Banner
              tone="incomplete"
              title={t("本次结果可能不完整")}
              action={
                onRetry ? (
                  <Button size="sm" variant="secondary" onClick={onRetry}>
                    {t("重新读取")}
                  </Button>
                ) : null
              }
            >
              {t("只读取到了 {n} 个仓库，", { n: repos.length })}
              {locale === "en" ? " " : ""}
              {missingPages.length > 0
                ? t("第 {n} 页没有读到。", { n: pageList })
                : t("还有一部分没有读到。")}
            </Banner>
          ) : null}

          {staleTitle ? (
            <Banner
              tone="stale"
              title={staleTitle}
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
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_15rem]">
        {/* -------------------------------------------------------- 筛选侧栏 */}
        <Panel
          variant="panel"
          cut="sm"
          as="aside"
          aria-label={t("筛选")}
          className="motion-panel-enter self-start"
        >
          <PanelHeader
            title={t("筛选")}
            subtitle={
              filterCount > 0
                ? t("已启用 {n} 个条件", { n: filterCount })
                : t("全部仓库")
            }
            actions={
              filterCount > 0 ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRarities(new Set());
                    setTags(new Set());
                    setDormantOnly(false);
                    setEmbersOnly(false);
                  }}
                >
                  {t("清除")}
                </Button>
              ) : null
            }
          />
          <div className="cut-frame__inner flex flex-col gap-5 p-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="display-cn text-2xs tracking-wide text-fg-muted">
                {t("稀有度")}
              </legend>
              {RARITY_ORDER.map((rarity) => {
                const copy = rarityLabel(rarity, locale);
                return (
                  <label
                    key={rarity}
                    className="flex cursor-pointer items-center gap-2 py-1 text-xs text-fg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={rarities.has(rarity)}
                      onChange={() => setRarities((prev) => toggle(prev, rarity))}
                      className="h-4 w-4 accent-[var(--color-gold)]"
                    />
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: copy.color }}
                    />
                    <span>{copy.label}</span>
                  </label>
                );
              })}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="display-cn text-2xs tracking-wide text-fg-muted">
                {t("状态")}
              </legend>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-secondary">
                <input
                  type="checkbox"
                  checked={dormantOnly}
                  onChange={(e) => setDormantOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--color-gold)]"
                />
                {t("仅沉睡（≥ {n} 天）", { n: THRESHOLDS.quietMinDays })}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-secondary">
                <input
                  type="checkbox"
                  checked={embersOnly}
                  onChange={(e) => setEmbersOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--color-gold)]"
                />
                {t("有余烬（≥ {n} 天且 Star ≥ {m}）", {
                  n: THRESHOLDS.emberMinDays,
                  m: THRESHOLDS.emberMinStars,
                })}
              </label>
            </fieldset>

            {availableTags.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="display-cn text-2xs tracking-wide text-fg-muted">
                  {t("标签")}
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => (
                    <TagChip
                      key={tag}
                      id={tag}
                      selected={tags.has(tag)}
                      onClick={() => setTags((prev) => toggle(prev, tag))}
                    />
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="repo-sort"
                className="display-cn text-2xs tracking-wide text-fg-muted"
              >
                {t("排序")}
              </label>
              <select
                id="repo-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-sm border border-hairline bg-surface-inset px-3 py-2 text-xs text-fg-primary"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Panel>

        {/* ------------------------------------------------------------ 网格 */}
        <div className="min-w-0">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="display-cn text-lg text-fg-primary">
              {t("全部仓库")}
              <span className="ml-2 text-sm text-fg-muted">
                {formatCount(visible.length, locale)}
              </span>
            </h2>
            {/* 悬停提示只在真的有悬停预览时才出现：预览面板本身要 `xl`
                才渲染，触屏也没有「悬停」这件事。 */}
            <p className="hidden text-2xs text-fg-muted xl:block">
              {t("悬停查看细节")}
            </p>
          </div>

          {visible.length === 0 ? (
            <Panel variant="inset" cut="sm">
              <div className="cut-frame__inner">
                <EmptyState
                  title={t("没有符合条件的仓库。")}
                  description={t("把筛选条件放宽一点，或者清除全部条件再看一遍。")}
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRarities(new Set());
                        setTags(new Set());
                        setDormantOnly(false);
                        setEmbersOnly(false);
                      }}
                    >
                      {t("清除筛选")}
                    </Button>
                  }
                />
              </div>
            </Panel>
          ) : (
            <ul
              className={cx(
                "grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4",
                animateItems ? "" : "motion-panel-enter",
              )}
            >
              {visible.map((repo, index) => (
                <li
                  key={repo.fullName}
                  className={animateItems ? "motion-panel-enter" : undefined}
                  style={
                    animateItems
                      ? { animationDelay: `var(--stagger-${Math.min(index + 1, 5)})` }
                      : undefined
                  }
                >
                  <div onMouseEnter={() => setPreview(repo)} onFocus={() => setPreview(repo)}>
                    <RepoCard repo={repo} readAt={envelope.readAt} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* -------------------------------------------------------- 悬停预览 */}
        <div className="hidden xl:block">
          <div className="sticky top-24">
            <Panel variant="raised" cut="sm" aria-label={t("预览")}>
              <div className="cut-frame__inner flex flex-col gap-4 p-5">
                {preview ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex flex-none items-center justify-center rounded-sm border border-hairline-soft bg-surface-inset p-2">
                        <Sigil name={preview.fullName} size={40} />
                      </span>
                      <p className="truncate font-mono text-sm text-fg-primary">
                        {preview.fullName}
                      </p>
                    </div>
                    <dl className="flex flex-col gap-1.5">
                      <HudRow
                        label={t("沉睡")}
                        value={
                          preview.dormantDays === null ? (
                            <UnknownValue label={t("沉睡天数")} />
                          ) : (
                            formatDuration(preview.dormantDays, locale)
                          )
                        }
                      />
                      <HudRow
                        label={t("Star")}
                        value={
                          preview.starCount === null ? (
                            <UnknownValue label={t("Star 数")} />
                          ) : (
                            preview.starCount
                          )
                        }
                      />
                      <HudRow
                        label={t("上游")}
                        value={
                          preview.upstream === null ? (
                            <FieldValue state={naField()} label={t("上游仓库")} />
                          ) : preview.upstream.owner === null ||
                            preview.upstream.repo === null ? (
                            <UnknownValue label={t("上游仓库")} />
                          ) : (
                            `${preview.upstream.owner}/${preview.upstream.repo}`
                          )
                        }
                      />
                    </dl>
                    {preview.description ? (
                      <p className="text-xs leading-relaxed text-fg-secondary">
                        {preview.description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {preview.tags.map((tag) => (
                        <TagChip key={tag} id={tag} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="py-8 text-center text-xs text-fg-muted">
                    {t("把指针放到任意一张卡上，这里会显示它的细节。")}
                  </p>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
