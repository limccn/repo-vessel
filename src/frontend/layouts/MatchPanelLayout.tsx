import { type KeyboardEvent } from "react";
import type { BoardId, BoardPayload, Envelope } from "@/shared/contract";
import { BOARD_IDS, boardLabel } from "@/shared/ids";
import { Sigil } from "@/frontend/components/card/Sigil";
import { Banner } from "@/frontend/components/chrome/Banner";
import { Button } from "@/frontend/components/common/Button";
import { EmptyState } from "@/frontend/components/feedback/EmptyState";
import { UnknownValue } from "@/frontend/components/feedback/FieldValue";
import { HudMeter } from "@/frontend/components/hud/HudMeter";
import { Panel } from "@/frontend/components/panel/Panel";
import { formatDuration, formatRelativeTime } from "@/shared/format";
import { repoTopicsLabel } from "@/shared/topic";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { REPO_TOPICS } from "@/frontend/lib/env";
import { ageHours, isStale } from "@/frontend/lib/freshness";
import { rarityMeterRatio, rarityMeterVars, rarityOf } from "@/frontend/lib/rarity";
import { cx } from "@/frontend/lib/cx";

const RANK_TONE: Record<number, string> = {
  1: "border-gold text-gold",
  2: "border-[var(--color-fg-secondary)] text-[var(--color-fg-secondary)]",
  3: "border-[var(--color-arcane)] text-[var(--color-arcane)]",
};

export interface MatchPanelLayoutProps {
  envelope: Envelope<BoardPayload>;
  /** 切换榜单。父级持有真实数据源。 */
  onSwitch?: (id: BoardId) => void;
  /** 重新读取。陈旧或部分失败时出现。 */
  onRetry?: () => void;
}

/**
 * L3 · Match Panel —— Dota 2 战报面板。
 *
 * 榜单就是一张记分板：横向对齐的列，序号徽标，每一行都是同一件宝物的登记。
 * 用真正的 `<table>`，因为它本来就是表格数据。
 *
 * 榜单名、说明与收录条件由服务端按请求语言下发，客户端原样渲染；
 * 表头、空态与提示条这些**页面自己的**文案经 `t()` 取当前语言。
 */
export function MatchPanelLayout({ envelope, onSwitch, onRetry }: MatchPanelLayoutProps) {
  const { t, locale } = useI18n();
  const board = envelope.data;
  /**
   * 选中的榜单就是正在显示的那一个 —— 不另存一份。
   * 另存一份会让「高亮的榜单」和「表里的数据」各说各话：
   * 高亮写着余烬榜，表里却还是沉睡榜的行。数据源在父级（`onSwitch`），
   * 这里只负责把意图交出去，再从信封里读回真实的那一个。
   */
  const active: BoardId = board?.id ?? "longest-sleep";

  /* 陈旧天数用共享的 `formatDuration()` 取词，单位才会跟着语言走；
     `staleAgeLabel()` 把「天」写死在字符串里，只适合简体中文。
     判定本身仍来自 `freshness`：超过 `THRESHOLDS.staleAfterHours` 才陈旧。 */
  const staleHours = ageHours(envelope.readAt);
  const staleDays =
    isStale(envelope.readAt) && staleHours !== null ? Math.ceil(staleHours / 24) : null;
  const staleAge = staleDays === null ? null : formatDuration(staleDays, locale);
  const staleTitle =
    staleAge === null ? null : t("榜单数据为 {ago} 前", { ago: staleAge });

  const handleSwitch = (id: BoardId) => {
    onSwitch?.(id);
  };

  /**
   * Tab 组的键盘操作：← → 切换，Home / End 跳到首尾，焦点跟着选中项走
   * （交互规范 §8.7）。
   */
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = BOARD_IDS.indexOf(active);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % BOARD_IDS.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + BOARD_IDS.length) % BOARD_IDS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = BOARD_IDS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const id = BOARD_IDS[next];
    if (!id) return;
    handleSwitch(id);
    document.getElementById(`board-tab-${id}`)?.focus();
  };

  return (
    <div className="mx-auto max-w-page px-4 py-8 sm:px-6">
      <Panel
        variant="panel"
        cut="lg"
        grain
        bevel
        as="section"
        aria-label={t("榜单")}
      >
        <div className="cut-frame__inner">
          {/* ---------------------------------------------------------- 抬头 */}
          <header className="flex flex-col gap-4 border-b border-hairline-soft px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h1 tabIndex={-1} className="display-cn text-xl text-fg-primary">
                {board?.name ?? boardLabel(active, locale).name}
              </h1>
              <p
                className={cx(
                  "text-2xs",
                  staleTitle ? "text-fg-muted" : "text-fg-secondary",
                )}
              >
                {t("读取于")}{" "}
                {envelope.readAt ? (
                  formatRelativeTime(envelope.readAt, locale) ?? envelope.readAt
                ) : (
                  <UnknownValue label={t("读取时间")} />
                )}
              </p>
            </div>

            {/* 榜单切换是一个 Tab 组，不是导航：交互规范 §8.1 / §8.4 要求
                role="tablist" / "tab" / "tabpanel"，并用方向键切换（§8.7）。 */}
            <div
              role="tablist"
              aria-label={t("榜单切换")}
              className="flex flex-wrap items-center gap-1"
            >
              {BOARD_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`board-tab-${id}`}
                  /* 这个 Tab 组自己管焦点：切换榜单也是一次路由切换，但焦点必须
                     跟着选中项走（交互规范 §8.7），不能被页面标题拽走。 */
                  data-owns-focus=""
                  aria-selected={active === id}
                  aria-controls="board-panel"
                  tabIndex={active === id ? 0 : -1}
                  onClick={() => handleSwitch(id)}
                  onKeyDown={handleTabKey}
                  className={cx(
                    "relative rounded-sm px-3 py-1.5 text-xs transition-colors",
                    "duration-[var(--motion-duration-fast)]",
                    active === id
                      ? "bg-surface-panel-raised text-fg-primary"
                      : "text-fg-secondary hover:text-fg-primary",
                  )}
                >
                  {boardLabel(id, locale).name}
                  {active === id ? (
                    <span
                      aria-hidden="true"
                      className="animate-tab-underline absolute inset-x-2 -bottom-px h-px origin-left bg-gold"
                    />
                  ) : null}
                </button>
              ))}
            </div>

            {board ? (
              <p className="text-xs leading-relaxed text-fg-secondary">
                {board.description} {board.criteria}
              </p>
            ) : null}
          </header>

          {/* ------------------------------------------------------- 不完整提示 */}
          {envelope.completeness === "partial" ? (
            <div className="px-6 pt-5">
              <Banner tone="incomplete" title={t("本次结果可能不完整")}>
                {t("有些页没有读到，下面的名次可能不完整。")}
              </Banner>
            </div>
          ) : null}

          {/* 陈旧 ≠ 错误：名次保留，只在顶部说明它是旧的（§5.4）。 */}
          {staleTitle ? (
            <div className="px-6 pt-5">
              <Banner
                tone="stale"
                title={staleTitle}
                action={
                  onRetry ? (
                    <Button size="sm" variant="secondary" onClick={onRetry}>
                      {t("刷新")}
                    </Button>
                  ) : null
                }
              >
                {t("名次仍然是真的，只是这些数据已经不是最新的了。")}
              </Banner>
            </div>
          ) : null}

          {/* ---------------------------------------------------------- 记分板 */}
          {board && board.entries.length > 0 ? (
            <div
              id="board-panel"
              role="tabpanel"
              aria-labelledby={`board-tab-${active}`}
            >
              {/* 窄屏：一行一条，竖着读。
                  46rem 的表放进 320px 的窗口只剩四分之一宽 —— 「沉睡」那一列
                  要横向滚动才看得到，而它正是这张榜的全部意义。所以小屏换成
                  卡片列表，`md` 以上才用真正的 `<table>`。两者用 display 切换，
                  读屏只会遇到其中一个。 */}
              <ol className="flex flex-col lg:hidden">
                {board.entries.map((entry) => {
                  const rarity = rarityOf(entry.dormantDays);
                  const ratio = rarityMeterRatio(entry.dormantDays);
                  const meter = rarity ? rarityMeterVars(rarity) : null;
                  return (
                    <li
                      key={`${entry.rank}-${entry.repo.fullName}`}
                      className="flex flex-col gap-2 border-b border-hairline-soft px-6 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cx(
                            "inline-flex h-6 w-6 flex-none items-center justify-center rounded-xs border text-2xs tnum",
                            RANK_TONE[entry.rank] ?? "border-hairline text-fg-muted",
                          )}
                        >
                          {String(entry.rank).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 break-words font-mono text-sm text-fg-primary">
                          {entry.repo.fullName}
                        </span>
                        <Sigil name={entry.repo.fullName} size={24} />
                      </div>
                      <div className="flex items-center gap-3 pl-9">
                        <HudMeter
                          ratio={ratio}
                          from={meter?.from ?? "var(--color-hairline)"}
                          to={meter?.to ?? "var(--color-hairline)"}
                          className="flex-1"
                        />
                        <span className="tnum flex-none text-sm text-data-emphasis">
                          {entry.dormantDays === null ? (
                            <UnknownValue label={t("沉睡天数")} />
                          ) : (
                            formatDuration(entry.dormantDays, locale)
                          )}
                        </span>
                      </div>
                      <div
                        className={cx(
                          "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pl-9 text-2xs",
                          staleTitle ? "text-fg-muted" : "text-fg-secondary",
                        )}
                      >
                        <span className="tnum">
                          {t("Star")}{" "}
                          {entry.repo.starCount === null ? (
                            <UnknownValue label={t("Star 数")} />
                          ) : (
                            entry.repo.starCount
                          )}
                        </span>
                        <span>
                          {t("读取于")}{" "}
                          {envelope.readAt ? (
                            formatRelativeTime(envelope.readAt, locale) ?? envelope.readAt
                          ) : (
                            <UnknownValue label={t("读取时间")} />
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="hidden overflow-x-auto px-6 py-5 lg:block">
                <table className="w-full min-w-[46rem] border-collapse">
                  <caption className="sr-only">
                    {board.name}
                    {/* 句号跟着语言走：中文用「。」，英语用句点加空格。 */}
                    {locale === "en" ? ". " : "。"}
                    {t("按沉睡天数排序，列出仓库、印记、沉睡天数与 Star 数。")}
                  </caption>
                  <thead>
                    <tr className="border-b border-hairline-soft text-left">
                      <th scope="col" className="w-14 py-2 pr-3 text-2xs font-normal tracking-wide text-fg-muted">
                        {t("名次")}
                      </th>
                      <th scope="col" className="w-14 py-2 pr-3 text-2xs font-normal tracking-wide text-fg-muted">
                        {t("印记")}
                      </th>
                      <th scope="col" className="py-2 pr-3 text-2xs font-normal tracking-wide text-fg-muted">
                        {t("仓库")}
                      </th>
                      <th scope="col" className="w-56 py-2 pr-3 text-2xs font-normal tracking-wide text-fg-muted">
                        {t("沉睡")}
                      </th>
                      <th scope="col" className="w-20 py-2 pr-3 text-right text-2xs font-normal tracking-wide text-fg-muted">
                        {t("Star")}
                      </th>
                      <th scope="col" className="w-24 py-2 text-right text-2xs font-normal tracking-wide text-fg-muted">
                        {t("读取于")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.entries.map((entry) => {
                      const rarity = rarityOf(entry.dormantDays);
                      const ratio = rarityMeterRatio(entry.dormantDays);
                      const meter = rarity ? rarityMeterVars(rarity) : null;
                      return (
                        <tr
                          key={`${entry.rank}-${entry.repo.fullName}`}
                          className="group border-b border-hairline-soft transition-colors duration-[var(--motion-duration-fast)] hover:bg-surface-inset"
                        >
                          <td className="py-3 pr-3">
                            <span
                              className={cx(
                                "inline-flex h-6 w-6 items-center justify-center rounded-xs border text-2xs tnum",
                                RANK_TONE[entry.rank] ?? "border-hairline text-fg-muted",
                              )}
                            >
                              {String(entry.rank).padStart(2, "0")}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <Sigil name={entry.repo.fullName} size={24} />
                          </td>
                          <td className="py-3 pr-3">
                            <span className="font-mono text-sm text-fg-primary">
                              {entry.repo.fullName}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3">
                              <HudMeter
                                ratio={ratio}
                                from={meter?.from ?? "var(--color-hairline)"}
                                to={meter?.to ?? "var(--color-hairline)"}
                                className="w-28"
                              />
                              <span className="tnum text-sm text-data-emphasis">
                                {entry.dormantDays === null ? (
                                  <UnknownValue label={t("沉睡天数")} />
                                ) : (
                                  formatDuration(entry.dormantDays, locale)
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="tnum py-3 pr-3 text-right text-sm text-data-secondary">
                            {entry.repo.starCount === null ? (
                              <UnknownValue label={t("Star 数")} />
                            ) : (
                              entry.repo.starCount
                            )}
                          </td>
                          <td
                            className={cx(
                              "py-3 text-right text-2xs",
                              staleTitle ? "text-fg-muted" : "text-fg-secondary",
                            )}
                          >
                            {envelope.readAt ? (
                              formatRelativeTime(envelope.readAt, locale) ?? envelope.readAt
                            ) : (
                              <UnknownValue label={t("读取时间")} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              id="board-panel"
              role="tabpanel"
              aria-labelledby={`board-tab-${active}`}
            >
              <EmptyState
                title={t("还没有仓库住进来。")}
                description={t(
                  "把你的一个公开仓库加上 {topic} 主题，它就会出现在这里。",
                  { topic: repoTopicsLabel(REPO_TOPICS, locale) },
                )}
              />
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
