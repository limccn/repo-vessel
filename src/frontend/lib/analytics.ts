/**
 * 客户端计数 —— 浏览器里**唯一**的埋点出口。
 *
 * 四件事在这里定死：
 *   1. **只发受控词汇。** 事件名与 `dim` 都来自 `src/shared/metrics.ts`；
 *      拼不出合法值就不发，而不是让服务端回一个 400。
 *   2. **尊重隐私信号。** `Do Not Track` 与 `Global Privacy Control` 任一开启，
 *      一条都不发 —— 这不是可选项。
 *   3. **旁路。** 全部包在 try/catch 里，返回 `void`，不 await、不抛、不阻塞渲染。
 *   4. **不带走任何用户数据。** 发给服务端的只有事件名与维度；路径先被
 *      `routeFromPath()` 归成类别，用户名、仓库名、查询串都不出门。
 *
 * 传输优先 `sendBeacon`（页面卸载时也能发出去），不可用时退回
 * `fetch(..., { keepalive: true })`。口径见 `docs/metrics.md`。
 */

import {
  classifyReferrer,
  isValidMetricDim,
  pageViewDim,
  routeFromPath,
  type ClientMetricEvent,
} from "@/shared/metrics";

/** 与 Worker 的 `METRICS_PATH` 对应。 */
export const METRICS_ENDPOINT = "/api/metrics/event";

type NavigatorWithPrivacy = Navigator & {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
};

/** 浏览器明确说「不要追踪」时不发。没有 `navigator`（SSR / 测试）时也不发。 */
function privacyBlocked(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as NavigatorWithPrivacy;
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/**
 * 记一次事件。`dim` 不合法时静默丢弃 —— 那是代码写错了，不该在用户浏览时
 * 变成一个失败请求。
 */
export function track(event: ClientMetricEvent, dim: string): void {
  if (privacyBlocked()) return;
  if (!isValidMetricDim(event, dim)) return;

  const payload = JSON.stringify({ event, dim });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(METRICS_ENDPOINT, blob)) return;
    }
  } catch {
    /* sendBeacon 不可用或抛错 —— 走下面的 fetch。 */
  }

  try {
    void fetch(METRICS_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: payload,
    }).catch(() => undefined);
  } catch {
    /* 计数是旁路：发不出去就少一次，页面不受影响。 */
  }
}

/**
 * 记一次页面访问。
 *
 * `pathname` 只用来判断**路由类别**；`search` 只看有没有 `?from=share`
 * （微信之类会剥掉 referrer，URL 上的标记是唯一还留着的证据）。
 */
export function trackPageView(pathname: string, search: string, referrer: string): void {
  if (typeof window === "undefined") return;

  const fromShare = new URLSearchParams(search).get("from") === "share";
  const src = classifyReferrer(referrer, window.location.origin, fromShare);
  track("page_view", pageViewDim(routeFromPath(pathname), src));
}
