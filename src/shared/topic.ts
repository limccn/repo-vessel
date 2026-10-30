/**
 * GitHub 主题（topic）的解析规则 —— **只写一次**。
 *
 * SPA 从 `VITE_REPO_TOPICS` 读原始值，Worker 从 `REPO_TOPICS` 绑定读原始值，
 * 两边都调用这里。规则只有这一份，所以「站点宣传的主题」与「Worker 查询的
 * 主题」不可能解析成两个东西。
 *
 * 主题是**配置**，不是常量：换一个部署就换一组主题，代码不用动。
 *
 * 从 v1.1 起主题是**一组**而不是一个：一个仓库只要带有其中任意一个主题就算
 * 入龛。默认的两个主题分别是站点的新名字与旧名字 —— 改了名，老仓库也不会
 * 一夜之间掉出灵龛。
 */

import { getActiveLocale, t, type Locale } from "./i18n";

/** 主主题。与站点的新名字（码之灵龛 / Repo Vessel）同名。 */
export const DEFAULT_REPO_TOPIC = "repo-vessel";
/** 等价主题。旧名字（URN OF REPOS 主图标上的那一个）。 */
export const LEGACY_REPO_TOPIC = "urn-of-repos";

/**
 * 默认主题列表。顺序就是展示顺序 —— 主主题在前。
 *
 * 不要直接改这个数组：解析函数返回副本，调用方拿到的列表可以自由使用。
 */
export const DEFAULT_REPO_TOPICS: readonly string[] = [
  DEFAULT_REPO_TOPIC,
  LEGACY_REPO_TOPIC,
];

/** GitHub 自己的主题长度上限。 */
export const MAX_TOPIC_LENGTH = 35;

/** 一次最多配置多少个主题 —— 防止一个写错的配置把查询撑爆。 */
export const MAX_TOPICS = 8;

/** 列表分隔符：半角/全角逗号、分号，以及任意空白。 */
const TOPIC_SEPARATORS = /[,，;；\s]+/;

/**
 * 把一个原始值归一化成合法的 GitHub 主题。
 *
 * 解析顺序：
 *
 * 1. `trim()`。
 * 2. 转小写 —— GitHub 主题本身就是小写的，`Repo-Vessel` 与 `repo-vessel`
 *    是同一个主题。
 * 3. 把 `[a-z0-9-]` 以外的每一个字符换成 `-`。
 * 4. 连续的 `-` 合并成一个。
 * 5. 去掉首尾的 `-`。
 * 6. 截断到 35 个字符，再去掉结尾的 `-` —— 被截断的主题不能以分隔符收尾。
 * 7. 结果为空 → `null`（由调用方决定回落成什么）。
 *
 * 归一化之后的主题一定是可以直接交给 GitHub 搜索的：只含小写字母、数字与
 * 连字符，不以连字符开头或结尾，长度不超过 35。
 */
export function normalizeTopic(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  const topic = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, MAX_TOPIC_LENGTH)
    .replace(/-+$/, "");

  return topic.length > 0 ? topic : null;
}

/**
 * 单值解析。缺失、非法或解析后为空时回落到主主题。
 *
 * 保留这个函数是因为「一个主题」仍然是合法配置 —— 列表里只有一项时，
 * 语义与 v1.0 完全一致。
 */
export function resolveRepoTopic(raw: string | null | undefined): string {
  return normalizeTopic(raw) ?? DEFAULT_REPO_TOPIC;
}

/**
 * 列表解析。逗号 / 分号 / 空白分隔，逐项归一化、去重并保序。
 *
 * 空项（例如 `a,,b` 或 `a, ,b`）被丢掉，**不会**回落成默认主题 ——
 * 否则一个手滑的逗号就会把 `repo-vessel` 重新塞进列表。
 * 全部解析为空时，才回落到默认列表。
 */
export function resolveRepoTopicList(raw: string | null | undefined): string[] {
  if (typeof raw !== "string") return [...DEFAULT_REPO_TOPICS];

  const seen = new Set<string>();
  const topics: string[] = [];

  for (const part of raw.split(TOPIC_SEPARATORS)) {
    if (part.trim().length === 0) continue;
    const topic = normalizeTopic(part);
    if (topic === null || seen.has(topic)) continue;
    seen.add(topic);
    topics.push(topic);
    if (topics.length >= MAX_TOPICS) break;
  }

  return topics.length > 0 ? topics : [...DEFAULT_REPO_TOPICS];
}

/**
 * 文案里的主题列表 —— 「repo-vessel 或 urn-of-repos」。
 *
 * 连接词随语言变（由 `src/shared/i18n.ts` 的词典提供），主题本身不变：
 * 它是 GitHub 上的标识符，不是文案。
 */
export function repoTopicsLabel(
  topics: readonly string[],
  locale: Locale = getActiveLocale(),
): string {
  return topics.join(` ${t("或", undefined, locale)} `);
}
