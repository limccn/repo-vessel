/**
 * 分享相关的两个路由。
 *
 * | 路由 | 做什么 |
 * |---|---|
 * | `GET /og/u/:username` | 1200×630 的 PNG。**读失败也画**，只是数字全变成 `? 未知` |
 * | `GET /u/:username` | 取静态 `index.html`，用 `HTMLRewriter` 改写按用户定制的 meta |
 *
 * **为什么 `/u/*` 只改写 URL 能决定的部分。** 改写要在 HTML 返回前完成，而
 * GitHub 读取可能几秒 —— 让分享链接的首字节等一次上游读取，是拿页面的可用性
 * 换预览卡的准确度。所以 HTML 里只写用户名，数字留在 `/og/u/:username` 那张
 * 图上，由爬虫随后单独取 —— 那张图有自己的缓存。
 *
 * **失败分三级，不能混：**
 *   - 用户名形态不对 → `400`。没有账户可画，也没有卡片。
 *   - 读取失败（不存在 / 组织 / 限流）→ **照常画图**，未知写成 `? 未知`。
 *   - 渲染失败（wasm / 字体）→ `302` 到品牌图。宁可给品牌图，不给破图。
 *
 * **语言来自 URL。** 爬虫不会带 cookie，也不会替我们保存选择：分享链接里的
 * `?lang=` 是唯一能跨平台传到预览卡上的载体，所以 `/u/:login` 把语言写进
 * `og:image`，`/og/u/:login` 读回来。缓存键里因此必须带上语言 —— 不加的话
 * 第一张被缓存的中文卡会喂给后来的每一个语种。
 */

import { siteCopy } from "@/shared/copy";
import type { Envelope, InspectPayload } from "@/shared/contract";
import {
  DEFAULT_LOCALE,
  LOCALE_TAGS,
  localeFromRequest,
  normalizeLocale,
  t,
  type Locale,
} from "@/shared/i18n";
import { classifyUserPageRequest } from "@/shared/metrics";
import { isValidUsername, loadInspectEnvelope } from "@/worker/api/inspect";
import { recordMetric } from "@/worker/db/metrics-store";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { factsFor } from "./facts";
import { renderOgPng } from "./render";
import { OG_HEIGHT, OG_WIDTH, buildOgCard } from "./svg";

/** PNG 缓存 6 小时 —— 与用户查询的缓存 TTL 一致，图上印着的 `readAt` 就是证据。 */
export const OG_CACHE_SECONDS = 21600;

/** 渲染失败的退路：站点自己的品牌图，永远在。 */
export const OG_FALLBACK_PATH = "/icon.jpg";

/** 注入点：单测不需要真的 wasm，也不需要真的 GitHub。 */
export interface OgDeps {
  load: typeof loadInspectEnvelope;
  render: (svg: string, locale: Locale) => Promise<Uint8Array>;
}

const DEFAULT_DEPS: OgDeps = { load: loadInspectEnvelope, render: renderOgPng };

/** Cache API 在 Workers 里一直有；Node 单测里没有。没有就当作未命中。 */
interface SharedCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function sharedCache(): SharedCache | null {
  const store = (globalThis as { caches?: { default?: SharedCache } }).caches;
  return store?.default ?? null;
}

/* -------------------------------------------------------------------------- */
/* OG 图                                                                       */
/* -------------------------------------------------------------------------- */

function pngResponse(png: Uint8Array, topics: readonly string[]): Response {
  // resvg 的 `asPng()` 声明成 `Uint8Array<ArrayBufferLike>`（理论上可能挂在
  // SharedArrayBuffer 上），而 `Response` 只收普通 `ArrayBuffer` 支撑的视图。
  // 它自己分配的就是普通 ArrayBuffer，这一个 cast 是两者之间的全部差距。
  return new Response(png as BodyInit, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": `public, max-age=${OG_CACHE_SECONDS}`,
      "x-repo-topics": topics.join(","),
    },
  });
}

export async function handleOgImage(
  env: Env,
  ctx: ExecutionContextLike | undefined,
  rawUsername: string,
  request: Request,
  topics: readonly string[],
  deps: OgDeps = DEFAULT_DEPS,
): Promise<Response> {
  // 语言先算：连 400 的正文也是给用户看的一句，没有理由只有它说中文。
  const locale = localeFromRequest(request);
  const username = rawUsername.trim();
  if (!isValidUsername(username)) {
    return new Response(`${t("用户名不太对。", undefined, locale)}\n`, {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const cache = sharedCache();
  // 缓存键：小写 login + 语言。GitHub 的 login 不区分大小写，而 `?v=2` 之类的
  // 分享参数不该各缓存一份 —— 但语言必须留，否则第一张卡会喂给所有语种。
  const cacheKey = new Request(
    new URL(`/og/u/${username.toLowerCase()}?lang=${locale}`, request.url).toString(),
    { method: "GET" },
  );
  const hit = cache ? await cache.match(cacheKey) : undefined;
  if (hit) return hit;

  const loaded = await deps.load(env, ctx, username, topics, locale);
  const envelope: Envelope<InspectPayload> | null = loaded.ok ? loaded.envelope : null;
  const facts = factsFor(envelope, username, new URL(request.url).host);

  let png: Uint8Array;
  try {
    png = await deps.render(buildOgCard(facts, locale), locale);
  } catch {
    return Response.redirect(new URL(OG_FALLBACK_PATH, request.url).toString(), 302);
  }

  const response = pngResponse(png, topics);
  if (cache) {
    const forCache = response.clone();
    if (ctx) ctx.waitUntil(cache.put(cacheKey, forCache).catch(() => undefined));
    else await cache.put(cacheKey, forCache).catch(() => undefined);
  }
  return response;
}

/* -------------------------------------------------------------------------- */
/* `/u/:username` 的 meta                                                      */
/* -------------------------------------------------------------------------- */

export interface UserMeta {
  title: string;
  url: string;
  image: string;
  alt: string;
}

/**
 * 纯函数：给定用户名与站点 origin，返回要写进 HTML 的四个值。
 * `twitter:card` 只在**这一条路由**上升级成 `summary_large_image` —— 站点
 * 全局仍是 1:1 的方图，换成大图会把龛顶龛底裁掉。
 */
export function planUserMeta(
  login: string,
  origin: string,
  locale: Locale = DEFAULT_LOCALE,
): UserMeta {
  const copy = siteCopy(locale);
  const langSuffix = locale === DEFAULT_LOCALE ? "" : `?lang=${locale}`;
  return {
    title: `@${login} · ${copy.siteName}`,
    url: `${origin}/u/${login}`,
    image: `${origin}/og/u/${login}${langSuffix}`,
    alt: t("@{login} 的{site}分享卡", { login, site: copy.siteName }, locale),
  };
}

function metaUpdates(meta: UserMeta): Array<[selector: string, content: string]> {
  return [
    ['meta[property="og:title"]', meta.title],
    ['meta[property="og:url"]', meta.url],
    ['meta[property="og:image"]', meta.image],
    ['meta[property="og:image:type"]', "image/png"],
    ['meta[property="og:image:width"]', String(OG_WIDTH)],
    ['meta[property="og:image:height"]', String(OG_HEIGHT)],
    ['meta[property="og:image:alt"]', meta.alt],
    ['meta[name="twitter:card"]', "summary_large_image"],
    ['meta[name="twitter:image"]', meta.image],
    ['meta[name="twitter:image:alt"]', meta.alt],
  ];
}

export async function handleUserPage(
  env: Env,
  request: Request,
  rawLogin: string,
  ctx?: ExecutionContextLike,
): Promise<Response> {
  if (!env.ASSETS) {
    return new Response(`${t("静态产物没有绑定。", undefined, localeFromRequest(request))}\n`, {
      status: 503,
    });
  }

  const origin = new URL(request.url).origin;
  const login = rawLogin.trim();
  const locale =
    normalizeLocale(new URL(request.url).searchParams.get("lang")) ??
    localeFromRequest(request);

  // 直接取根路径的 HTML：所有路由共用同一份，而 `/` 不会触发 assets 的
  // `html_handling` 重定向（`/index.html` 会被 308 到 `/`，多一跳）。
  const page = await env.ASSETS.fetch(
    new Request(new URL("/", origin).toString(), {
      method: "GET",
      headers: { accept: "text/html" },
    }),
  );

  const type = page.headers.get("content-type") ?? "";
  if (!page.ok || !type.includes("text/html")) return page;
  // 不认识的用户名原样返回：让 SPA 自己说「用户名不太对」，
  // 而不是拿一个不存在的账户去印一张预览卡。
  if (!isValidUsername(login)) return page;

  /* 分享链接的有效访问量。爬虫单列（不是人来的），`?from=share` 与外站
     referrer 都算分享；UA 只在内存里读一次，不存。 */
  const source = classifyUserPageRequest(
    request.url,
    request.headers.get("referer"),
    request.headers.get("user-agent"),
  );
  void recordMetric(env, "userpage_view", `src=${source}`, 1, ctx);

  const meta = planUserMeta(login, origin, locale);

  let rewriter = new HTMLRewriter();
  // 静态壳的 `lang` 是英语。这条路由知道访客要哪一种语言，所以顺手改掉 ——
  // 否则日语的分享页在浏览器眼里仍然是英语页，读屏的读音与断行都会错。
  rewriter = rewriter.on("html", {
    element: (element) => element.setAttribute("lang", LOCALE_TAGS[locale]),
  });
  for (const [selector, content] of metaUpdates(meta)) {
    rewriter = rewriter.on(selector, {
      element: (element) => element.setAttribute("content", content),
    });
  }

  const rewritten = rewriter.transform(page);
  const headers = new Headers(rewritten.headers);
  // 改写后长度变了；etag 描述的是改写前的字节。两者都不该留在响应上。
  headers.delete("content-length");
  headers.delete("etag");
  headers.set("cache-control", "public, max-age=300");

  return new Response(rewritten.body, { status: 200, headers });
}
