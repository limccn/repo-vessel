/**
 * Worker 入口。
 *
 * 七组路由：GitHub **登录**（`/api/auth/*` 与 `DELETE /api/session`）、GitHub
 * **读取**（`/api/inspect/:username`、`/api/repos/:owner/:repo`）、**分享图**
 * （`/og/u/:username`）、**分享页的 meta**（`/u/:username`）、M3 的**榜单**
 * （`/api/board/:id`）与**收录状态**（`/api/collection-status`）、**认领与隐藏**
 * （`/api/claim/:owner/:repo`）、唯一一条不需要登录的出口 **下架申请**
 * （`POST /api/takedown`、`GET /api/takedown/:ticket`），以及**测量埋点**
 * （`POST /api/metrics/event`）。其余 `/api/*` 回 501 的信封 —— 那是**未实现**，
 * 不是空结果，不能被前端读成「0 个仓库」。
 *
 * 与 SPA 的关系由 `wrangler.jsonc` 固定：
 *   assets  → ./dist，SPA 回退
 *   /api/* · /og/* · /u/*  → 先走 Worker（`run_worker_first`）
 *
 * 只有这三类前缀会进到 Worker；其余路径由静态产物直接接走，不经过这里。
 */

import { localeFromRequest, t } from "@/shared/i18n";
import { resolveRepoTopicList } from "@/shared/topic";
import { handleBoard } from "@/worker/api/board";
import { handleClaim } from "@/worker/api/claim";
import { handleMyClaims } from "@/worker/api/claims";
import { handleCollectionStatus } from "@/worker/api/collection-status";
import { handleInspect } from "@/worker/api/inspect";
import { handleMetricEvent } from "@/worker/api/metrics";
import { handleRepo } from "@/worker/api/repo";
import { jsonError, makeError } from "@/worker/api/respond";
import { handleTakedownStatus, handleTakedownSubmit } from "@/worker/api/takedown";
import { handleAuth } from "@/worker/auth/routes";
import { runCollection } from "@/worker/collect/run";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { handleOgImage, handleUserPage } from "@/worker/share/routes";

export type { Env };

const INSPECT_PATH = /^\/api\/inspect\/([^/]+)\/?$/;
const REPO_PATH = /^\/api\/repos\/([^/]+)\/([^/]+)\/?$/;
const BOARD_PATH = /^\/api\/board\/([^/]+)\/?$/;
const COLLECTION_STATUS_PATH = /^\/api\/collection-status\/?$/;
const CLAIM_PATH = /^\/api\/claim\/([^/]+)\/([^/]+)\/?$/;
const CLAIMS_PATH = /^\/api\/claims\/?$/;
const TAKEDOWN_PATH = /^\/api\/takedown\/?$/;
const TAKEDOWN_TICKET_PATH = /^\/api\/takedown\/([^/]+)\/?$/;
const METRICS_PATH = /^\/api\/metrics\/event\/?$/;
const OG_PATH = /^\/og\/u\/([^/]+)\/?$/;
/** 只改写个人信息页本身；`/u/:name/repos` 之类的子路由原样交给 SPA。 */
const USER_PAGE_PATH = /^\/u\/([^/]+)\/?$/;

/**
 * 路径片段的解码。`%` 后面跟了非十六进制时 `decodeURIComponent` 会抛 ——
 * 那是客户端的错，不该变成 500。解不开就当作空串，交给后面的校验拒掉。
 */
function decodeSegment(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx?: ExecutionContextLike,
  ): Promise<Response> {
    const topics = resolveRepoTopicList(env.REPO_TOPICS);
    /* 一次请求的语言只解析一次：`?lang=` → `x-rv-locale` → `Accept-Language`
       → 英语。纯文本 405/404 与需要服务端散文的两个接口都读它。 */
    const locale = localeFromRequest(request);

    const authResponse = await handleAuth(request, env);
    if (authResponse) {
      /* 登录相关响应也带上主题回显：一条核对规则覆盖全部响应，
         不存在「有些响应看不到实际主题」的角落。 */
      authResponse.headers.set("x-repo-topics", topics.join(","));
      return authResponse;
    }

    const { pathname } = new URL(request.url);
    const inspectMatch = INSPECT_PATH.exec(pathname);
    const repoMatch = REPO_PATH.exec(pathname);
    const boardMatch = BOARD_PATH.exec(pathname);
    const collectionStatusMatch = COLLECTION_STATUS_PATH.exec(pathname);
    const claimMatch = CLAIM_PATH.exec(pathname);
    const claimsMatch = CLAIMS_PATH.exec(pathname);
    const takedownMatch = TAKEDOWN_PATH.exec(pathname);
    const takedownTicketMatch = takedownMatch ? null : TAKEDOWN_TICKET_PATH.exec(pathname);
    const metricsMatch = METRICS_PATH.exec(pathname);
    const ogMatch = OG_PATH.exec(pathname);
    const userPageMatch = USER_PAGE_PATH.exec(pathname);
    const isGet = request.method.toUpperCase() === "GET";

    if (inspectMatch || repoMatch) {
      if (!isGet) {
        return jsonError(
          makeError("client_unsupported", { message: t("这个接口只支持 GET。", undefined, locale) }),
          {
            topics,
            status: 405,
          },
        );
      }
      if (inspectMatch) {
        return handleInspect(env, ctx, decodeSegment(inspectMatch[1]), topics, locale);
      }
      return handleRepo(
        env,
        ctx,
        decodeSegment(repoMatch?.[1]),
        decodeSegment(repoMatch?.[2]),
        topics,
      );
    }

    if (boardMatch) {
      if (!isGet) {
        return jsonError(
          makeError("client_unsupported", { message: t("这个接口只支持 GET。", undefined, locale) }),
          {
            topics,
            status: 405,
          },
        );
      }
      return handleBoard(env, ctx, decodeSegment(boardMatch[1]), topics, locale);
    }

    if (collectionStatusMatch) {
      if (!isGet) {
        return jsonError(
          makeError("client_unsupported", { message: t("这个接口只支持 GET。", undefined, locale) }),
          {
            topics,
            status: 405,
          },
        );
      }
      return handleCollectionStatus(env, request, topics);
    }

    if (claimsMatch) {
      if (!isGet) {
        return jsonError(
          makeError("client_unsupported", { message: t("这个接口只支持 GET。", undefined, locale) }),
          {
            topics,
            status: 405,
          },
        );
      }
      return handleMyClaims(request, env, topics);
    }

    if (claimMatch) {
      return handleClaim(
        request,
        env,
        {
          owner: decodeSegment(claimMatch[1]),
          name: decodeSegment(claimMatch[2]),
          topics,
        },
        ctx,
      );
    }

    if (metricsMatch) {
      return handleMetricEvent(env, request, topics, ctx);
    }

    if (takedownMatch) {
      /* 下架申请不需要登录 —— 这是它存在的全部理由。 */
      if (request.method.toUpperCase() !== "POST") {
        return jsonError(
          makeError("client_unsupported", { message: t("这个接口只支持 POST。", undefined, locale) }),
          {
            topics,
            status: 405,
          },
        );
      }
      return handleTakedownSubmit(env, request, topics, ctx);
    }

    if (takedownTicketMatch) {
      if (!isGet) {
        return jsonError(
          makeError("client_unsupported", { message: t("这个接口只支持 GET。", undefined, locale) }),
          {
            topics,
            status: 405,
          },
        );
      }
      return handleTakedownStatus(env, decodeSegment(takedownTicketMatch[1]), topics);
    }

    if (ogMatch) {
      if (!isGet) {
        return new Response(`${t("这个地址只支持 GET。", undefined, locale)}\n`, {
          status: 405,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return handleOgImage(env, ctx, decodeSegment(ogMatch[1]), request, topics);
    }

    if (userPageMatch) {
      if (!isGet) {
        return new Response(`${t("这个地址只支持 GET。", undefined, locale)}\n`, {
          status: 405,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return handleUserPage(env, request, decodeSegment(userPageMatch[1]), ctx);
    }

    if (isApiPath(pathname)) {
      /* 没实现的接口回 501：是「还没有」，不是「没有」。 */
      return jsonError(makeError("client_unsupported"), { topics, status: 501 });
    }

    if (pathname.startsWith("/og/")) {
      return new Response(`${t("没有这个分享图。", undefined, locale)}\n`, {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    /* `/u/*` 的其它路径（例如 `/u/limccn/repos`）以及将来可能加进来的
       前缀，一律交还给静态产物 —— SPA 回退会给出 index.html。 */
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return jsonError(makeError("client_unsupported"), { topics, status: 501 });
  },

  /**
   * Cron 入口（`triggers.crons` 里那一行每六小时触发一次）。
   *
   * 跑一轮收录。缺 DB 或缺读取令牌时 `runCollection` 直接返回 `null` ——
   * 部署残缺不该变成每六小时一条错误日志。真正的异常记下来，不让平台把它
   * 变成一次无声的重试风暴。
   */
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    try {
      const summary = await runCollection(env);
      if (summary) console.log(`collect: ${summary.summary}`);
    } catch (error) {
      console.error("collect: run failed", error);
    }
  },
};
