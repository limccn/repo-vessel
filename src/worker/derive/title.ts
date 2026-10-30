/**
 * 称号 —— 固定规则、只陈述事实。
 *
 * 称号是**给账户的一个说法**，不是对一个人的评价：每条都附带 `evidence`，
 * 而且证据里只有数字与期限。没有「最懒」「失败」「高产」这类判断。
 *
 * 所有阈值来自 `THRESHOLDS`。这条约束是为了让界面上公开的阈值说明与代码里
 * 实际使用的数字是同一份 —— 否则网站会公布一条自己并不执行的规则。
 *
 * **句子交给词典，数字留在代码里。** 称号名走 `titleLabel()`，证据句走 `t()`：
 * 每种语言的语序不同，把数字拼进中文句子再翻译是拼不出来的。阈值、优先级与
 * 「未知不是 0」的规则都不随语言变。
 */

import type { InspectPayload, RepoSummary, TitleId } from "@/shared/contract";
import { t, type Locale } from "@/shared/i18n";
import { titleLabel } from "@/shared/ids";
import { THRESHOLDS } from "@/shared/thresholds";

export type TitlePayload = InspectPayload["title"];

function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`;
}

/**
 * 优先级：先看「账户是不是还很新」，再看沉睡、余烬，最后看构成（Fork / 原创）。
 *
 * 这个顺序不是审美选择 —— 「初访者」是对一个只有一两个仓库的账户最准确的
 * 描述，此时再给它一个「时光收藏家」只会让人困惑。
 */
export function deriveTitle(
  repos: RepoSummary[],
  repoCount: number | null,
  locale: Locale,
): TitlePayload {
  const pick = (id: TitleId, evidence: string[]): TitlePayload => ({
    id,
    name: titleLabel(id, locale).name,
    evidence: evidence.map((text) => ({ text })),
  });

  if (repoCount === null) {
    // 仓库数量未知时不给任何基于数量的称号 —— 也不编证据。
    return pick("visitor", []);
  }

  if (repoCount < THRESHOLDS.visitorMinRepos) {
    return pick(
      "visitor",
      [
        repoCount === 0
          ? t("还没有公开仓库。", undefined, locale)
          : t("公开仓库少于 {n} 个。", { n: THRESHOLDS.visitorMinRepos }, locale),
      ],
    );
  }

  const capsuleCount = repos.filter((repo) => repo.tags.includes("capsule")).length;
  if (capsuleCount > 0) {
    return pick("time-collector", [
      t("有 {n} 个仓库最后一次推送在三年前或更早。", { n: capsuleCount }, locale),
    ]);
  }

  const emberCount = repos.filter((repo) => repo.tags.includes("ember")).length;
  if (emberCount > 0) {
    return pick("ember-keeper", [
      t("有 {n} 个仓库安静了一年以上，仍然有 Star。", { n: emberCount }, locale),
    ]);
  }

  const forks = repos.filter((repo) => repo.isFork === true).length;
  if (
    forks >= THRESHOLDS.forkVoyagerMinForks &&
    forks / repoCount >= THRESHOLDS.forkVoyagerMinRatio
  ) {
    return pick("fork-voyager", [
      t(
        "{n} 个仓库是 Fork，占公开仓库的 {percent}。",
        { n: forks, percent: percent(forks, repoCount) },
        locale,
      ),
    ]);
  }

  const originals = repos.filter((repo) => repo.isFork === false).length;
  if (
    originals >= THRESHOLDS.ideaSowerMinOriginals &&
    originals / repoCount >= THRESHOLDS.ideaSowerMinRatio
  ) {
    return pick("idea-sower", [
      t(
        "{n} 个原创仓库，占公开仓库的 {percent}。",
        { n: originals, percent: percent(originals, repoCount) },
        locale,
      ),
    ]);
  }

  return pick("light-traveler", [
    t("公开仓库 {n} 个，其中 Fork {m} 个。", { n: repoCount, m: forks }, locale),
  ]);
}
