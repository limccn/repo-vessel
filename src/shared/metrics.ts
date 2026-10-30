/**
 * 测量的事件词汇 —— SPA 与 Worker **共用这一份**。
 *
 * 三条规则：
 *   1. 事件名是联合类型，任何一侧都不许写裸字符串。
 *   2. `dim` 是**受控维度**，不是自由文本。它只描述事件的类别，永远不带
 *      用户名、仓库名、IP、UA 或 URL。
 *   3. 客户端只能发 `CLIENT_METRIC_EVENTS` 里的三种；服务端逐事件用同一个
 *      校验器复核，不依赖客户端自律。
 *
 * 指标口径见 `docs/metrics.md`，存储见 `migrations/0003_metrics.sql`。
 */

/** 浏览器可以发的三种事件。其余只由 Worker 自己记。 */
export const CLIENT_METRIC_EVENTS = ["page_view", "share_card", "topic_copy"] as const;

export type ClientMetricEvent = (typeof CLIENT_METRIC_EVENTS)[number];

export type MetricEvent =
  | ClientMetricEvent
  | "inspect_read"
  | "claim_action"
  | "takedown_submit"
  | "userpage_view"
  | "collect_run";

/** 路由**类别**。路径参数（用户名、仓库名）不进门。 */
export type PageRoute =
  | "home"
  | "inspect"
  | "repos"
  | "board"
  | "how"
  | "manage"
  | "takedown"
  | "other";

/**
 * 页面来源的四分类：
 *   - `share`    分享链接（`?from=share`，或外站 referrer）
 *   - `external` 外站 referrer，但没有分享标记
 *   - `internal` 站内跳转 / 同站刷新
 *   - `direct`   没有 referrer
 */
export type ReferrerSource = "direct" | "internal" | "external" | "share";

/** 分享页的一次文档请求属于谁。爬虫单列，不算「有效访问」。 */
export type UserPageSource = "share" | "direct" | "crawler";

export const METRIC_DIM_MAX_CHARS = 64;

/** 维度字符串允许的字符集。只够表达 `事件:结果` 与 `键=值,键=值`。 */
const DIM_CHARSET = /^[a-z0-9:=.,_|-]*$/;

const PAGE_VIEW_DIM =
  /^route=(home|inspect|repos|board|how|manage|takedown|other),src=(direct|internal|external|share)$/;

const TOPIC_COPY_DIM = /^topic=[a-z0-9-]{1,35}$/;

const INSPECT_READ_DIM = /^(complete|partial|failed:[a-z_]+)$/;

const CLAIM_ACTION_DIM =
  /^(claim|hide|restore):(ok|not_owner|is_org|not_public|not_enrolled|error:[a-z_]+)$/;

const USER_PAGE_DIM = /^src=(share|direct|crawler)$/;

const COLLECT_RUN_DIM = /^(searches|discovered|verified_reads|delisted|unconfirmed)$/;

/** 爬虫 UA。只为把抓取从「有效访问」里分出去，读完即弃，不存。 */
const CRAWLER_UA =
  /bot\b|crawler|spider|facebookexternalhit|embeddable|embedly|preview|slackbot|telegrambot|discordbot/i;

/**
 * 路径 → 路由类别。查询串与尾部斜杠先去掉；不认识的路径归 `other`。
 * **绝不返回路径本身** —— 那是用户数据。
 */
export function routeFromPath(pathname: string): PageRoute {
  const path = (pathname.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/how") return "how";
  if (path === "/manage") return "manage";
  if (path === "/takedown") return "takedown";

  const segments = path.split("/").filter((segment) => segment.length > 0);
  if (segments[0] === "u" && segments.length === 2) return "inspect";
  if (segments[0] === "u" && segments.length === 3 && segments[2] === "repos") return "repos";
  if (segments[0] === "b" && segments.length === 2) return "board";
  return "other";
}

function originOf(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * referrer → 来源类别。分享标记优先于 referrer：微信、WhatsApp 之类会剥掉
 * referrer，只有 URL 上的 `?from=share` 还留着。
 */
export function classifyReferrer(
  referrer: string | null | undefined,
  origin: string | null | undefined,
  fromShare = false,
): ReferrerSource {
  if (fromShare) return "share";
  const refOrigin = originOf(referrer);
  if (refOrigin === null) return "direct";
  const ownOrigin = originOf(origin);
  if (ownOrigin === null) return "external";
  return refOrigin === ownOrigin ? "internal" : "external";
}

export function pageViewDim(route: PageRoute, src: ReferrerSource): string {
  return `route=${route},src=${src}`;
}

/**
 * 分享页的一次请求：**爬虫优先**。一个 Twitterbot 抓 OG 图不是人来过。
 * 其次看 `?from=share`，再看外站 referrer；同站刷新算 `direct`。
 */
export function classifyUserPageRequest(
  url: string,
  referrer: string | null | undefined,
  userAgent: string | null | undefined,
): UserPageSource {
  if (typeof userAgent === "string" && CRAWLER_UA.test(userAgent)) return "crawler";

  let marker = false;
  let origin: string | null = null;
  try {
    const parsed = new URL(url);
    marker = parsed.searchParams.get("from") === "share";
    origin = parsed.origin;
  } catch {
    /* 解析不了的 URL 没有分享标记，也没有 origin —— 下面按 referrer 判断。 */
  }

  const refOrigin = originOf(referrer);
  if (refOrigin !== null && origin !== null && refOrigin !== origin) return "share";
  if (marker) return "share";
  return "direct";
}

export function isClientMetricEvent(value: unknown): value is ClientMetricEvent {
  return (
    typeof value === "string" &&
    (CLIENT_METRIC_EVENTS as readonly string[]).includes(value)
  );
}

/** 逐事件校验 dim。客户端白名单之外的调用也应该通过 —— 服务端自己也要复核。 */
export function isValidMetricDim(event: MetricEvent, dim: string): boolean {
  if (typeof dim !== "string") return false;
  if (dim.length > METRIC_DIM_MAX_CHARS) return false;
  if (!DIM_CHARSET.test(dim)) return false;

  switch (event) {
    case "page_view":
      return PAGE_VIEW_DIM.test(dim);
    case "share_card":
      return dim === "ok" || dim === "failed";
    case "topic_copy":
      return TOPIC_COPY_DIM.test(dim);
    case "inspect_read":
      return INSPECT_READ_DIM.test(dim);
    case "claim_action":
      return CLAIM_ACTION_DIM.test(dim);
    case "takedown_submit":
      return dim === "received";
    case "userpage_view":
      return USER_PAGE_DIM.test(dim);
    case "collect_run":
      return COLLECT_RUN_DIM.test(dim);
    default:
      return false;
  }
}
