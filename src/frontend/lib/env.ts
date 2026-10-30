import { repoTopicsLabel, resolveRepoTopicList } from "@/shared/topic";

/**
 * 站点运行时配置 —— **唯一**的环境入口。
 *
 * 所有配置都在构建时由 Vite 注入（`VITE_` 前缀），所以换部署只需要换环境
 * 变量，代码不用动。缺省值写在下面每一个常量旁边，`.env.example` 里也写了
 * 同一份，两处必须一致。
 *
 * 取值为空的变量一律回落到缺省值：一个 `VITE_TWITTER_HANDLE=` 的空行不应该
 * 把页脚链接变成 `https://twitter.com/`。
 */

function nonEmpty(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  return value && value.length > 0 ? value : fallback;
}

/**
 * 本站宣传的 GitHub 主题列表。
 *
 * `VITE_REPO_TOPICS` 是逗号分隔的列表；一个仓库带有其中任意一个主题就算
 * 入龛。Worker 那边读的是 `REPO_TOPICS` 绑定（`wrangler.jsonc` 的 `vars`），
 * 两边走的是**同一套**解析规则（`src/shared/topic.ts`），所以主题的形状不会
 * 两边不一样。两个环境变量本身配成不同的值时，Worker 会把它实际使用的列表
 * 放在 `x-repo-topics` 响应头里，一次 `curl` 就能看出对不对得上。
 */
export const REPO_TOPICS: readonly string[] = resolveRepoTopicList(
  import.meta.env.VITE_REPO_TOPICS,
);

/** 文案里的主题列表：「repo-vessel 或 urn-of-repos」。 */
export const REPO_TOPIC_LABEL = repoTopicsLabel(REPO_TOPICS);

/** 本项目的 GitHub 仓库。页脚外链使用。 */
export const GITHUB_REPO_URL = nonEmpty(
  import.meta.env.VITE_GITHUB_REPO_URL,
  "https://github.com/limccn/repo-vessel",
);

/** 维护者的 Twitter / X 账号（不含 `@`）。 */
export const TWITTER_HANDLE = nonEmpty(
  import.meta.env.VITE_TWITTER_HANDLE,
  "limccn",
).replace(/^@+/, "");

/** 页脚 Twitter 外链。 */
export const TWITTER_URL = `https://twitter.com/${TWITTER_HANDLE}`;

/**
 * 站点自身的地址。分享文案里的链接用它。
 *
 * 运行时取 `location.origin`：同一份构建部署到预览域名与正式域名时，
 * 分享出去的链接都指向用户当时访问的那一个，不会把预览地址发到朋友圈。
 */
export const SITE_URL =
  typeof window === "undefined" ? "" : window.location.origin;
