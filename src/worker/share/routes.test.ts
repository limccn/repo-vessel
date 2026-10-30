// @vitest-environment node
/**
 * `/og/u/:username` 与 `/u/:username` 的两种失败。
 *
 * 这个文件守的是**失败分级**，也就是三种失败各自长什么样：
 *   - 用户名形态不对 → 400，一次上游读取都不发起；
 *   - 读取失败        → 照常画图，图上只有用户名与 `? 未知`；
 *   - 渲染失败        → 302 到品牌图，不给破图。
 *
 * `render.ts` 在真实 Worker 里 import 了 wasm 与 ttf，Node 里加载不了 ——
 * 所以整个模块被替掉；这里要测的本来也不是 resvg 画得对不对，而是**画不出来时
 * 返回什么**。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Envelope, InspectPayload } from "@/shared/contract";
import type { Env } from "@/worker/env";
import type { InspectLoad } from "@/worker/api/inspect";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";
import { OG_CACHE_SECONDS, handleOgImage, handleUserPage, planUserMeta } from "./routes";

const { renderOgPng } = vi.hoisted(() => ({ renderOgPng: vi.fn() }));

vi.mock("./render", () => ({ renderOgPng }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const TOPICS = ["repo-vessel"];

const emptyEnvelope: Envelope<InspectPayload> = {
  data: {
    account: { login: "limccn", type: "User", avatarUrl: null },
    repoCount: 1,
    enrolledCount: 1,
    stats: { longestDormantDays: 4967, emberCount: 0, forkCount: 0, archivedCount: 0 },
    title: { id: "time-collector", name: "时光收藏家", evidence: [] },
    representatives: { longestDormant: null, brightestEmber: null, travelledFork: null },
    repos: [],
    reposTruncated: false,
  },
  completeness: "complete",
  missingPages: [],
  readAt: "2026-11-01T09:12:00.000Z",
};

function request(path = "/og/u/limccn"): Request {
  return new Request(`https://repovessel.lmlh.net${path}`);
}

type Renderer = (svg: string, locale: string) => Promise<Uint8Array>;

function deps(load: InspectLoad, render: Renderer = renderOgPng as unknown as Renderer) {
  return { load: vi.fn().mockResolvedValue(load), render };
}

const FAILED: InspectLoad = {
  ok: false,
  error: { code: "account_not_found", message: "没有找到这个 GitHub 账户。" },
};

function svgOf(mock: { mock: { calls: unknown[][] } }): string {
  return String(mock.mock.calls[0]?.[0] ?? "");
}

describe("handleOgImage", () => {
  // 每个用例都从零开始：否则 `calls[0]` 会是上一个用例画的那张卡。
  beforeEach(() => renderOgPng.mockReset());

  it("画出 1200×630 的 PNG，并按 6 小时缓存", async () => {
    renderOgPng.mockResolvedValue(PNG);
    const injected = deps({ ok: true, envelope: emptyEnvelope });

    const response = await handleOgImage({} as Env, undefined, "limccn", request(), TOPICS, injected);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(`public, max-age=${OG_CACHE_SECONDS}`);
    expect(response.headers.get("x-repo-topics")).toBe("repo-vessel");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
  });

  it("读不到时照常画，整张卡只有用户名与未知", async () => {
    renderOgPng.mockResolvedValue(PNG);
    const injected = deps(FAILED);

    const response = await handleOgImage(
      {} as Env,
      undefined,
      "limccn",
      request("/og/u/limccn?lang=zh-Hans"),
      TOPICS,
      injected,
    );
    const svg = svgOf(renderOgPng);

    expect(response.status).toBe(200);
    expect(svg).toContain("@limccn");
    // 称号 1 处 + 三行数字 3 处 + 读取时间 1 处。
    expect((svg.match(/\? 未知/g) ?? []).length).toBe(5);
    expect(svg).not.toContain("未启封");
    expect(svg).not.toMatch(/\d+\s*个/);
  });

  it("用户名形态不对时回 400，既不读上游也不画图", async () => {
    const injected = deps({ ok: true, envelope: emptyEnvelope });

    const response = await handleOgImage({} as Env, undefined, "a b!", request(), TOPICS, injected);

    expect(response.status).toBe(400);
    expect(injected.load).not.toHaveBeenCalled();
    expect(renderOgPng).not.toHaveBeenCalled();
  });

  it("渲染失败时 302 到品牌图，不给破图", async () => {
    // 这里刻意不用 spy：Vitest 会把「mock 的返回值是一个被拒绝的 Promise」
    // 记成这个用例的错误结果，于是 `handleOgImage` 明明接住了也会被判失败。
    // 要测的只是「渲染器抛错时返回什么」，一个普通函数说得更准。
    const injected = deps({ ok: true, envelope: emptyEnvelope }, () =>
      Promise.reject(new Error("wasm 挂了")),
    );

    const response = await handleOgImage({} as Env, undefined, "limccn", request(), TOPICS, injected);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://repovessel.lmlh.net/icon.jpg");
  });

  it("语言跟着 ?lang= 走，渲染器拿到的是同一个语言", async () => {
    renderOgPng.mockResolvedValue(PNG);
    const injected = deps({ ok: true, envelope: emptyEnvelope });

    await handleOgImage(
      {} as Env,
      undefined,
      "limccn",
      request("/og/u/limccn?lang=ja"),
      TOPICS,
      injected,
    );

    expect(renderOgPng.mock.calls[0]?.[1]).toBe("ja");
    expect(svgOf(renderOgPng)).toContain("コードの霊龕");
  });

  it("语言进缓存键 —— 一张中文卡不能喂给英语访客", async () => {
    renderOgPng.mockResolvedValue(PNG);
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", { default: { match: async () => undefined, put } });

    try {
      await handleOgImage(
        {} as Env,
        undefined,
        "limccn",
        request("/og/u/LimCCN?lang=zh-Hant"),
        TOPICS,
        deps({ ok: true, envelope: emptyEnvelope }),
      );
    } finally {
      vi.unstubAllGlobals();
    }

    const key = String((put.mock.calls[0]?.[0] as Request | undefined)?.url ?? "");
    expect(key).toBe("https://repovessel.lmlh.net/og/u/limccn?lang=zh-Hant");
  });

  it("卡上的域名来自请求，不是写死的生产域名", async () => {
    renderOgPng.mockResolvedValue(PNG);
    const injected = deps({ ok: true, envelope: emptyEnvelope });

    await handleOgImage(
      {} as Env,
      undefined,
      "limccn",
      new Request("http://localhost:8787/og/u/limccn"),
      TOPICS,
      injected,
    );

    expect(svgOf(renderOgPng)).toContain("localhost:8787");
  });
});

describe("planUserMeta", () => {
  it("四个值都按用户名、origin 与语言定", () => {
    expect(planUserMeta("limccn", "https://repovessel.lmlh.net", "zh-Hans")).toEqual({
      title: "@limccn · 码之灵龛",
      url: "https://repovessel.lmlh.net/u/limccn",
      image: "https://repovessel.lmlh.net/og/u/limccn?lang=zh-Hans",
      alt: "@limccn 的码之灵龛分享卡",
    });
  });

  it("默认语言不带参数 —— 干净的分享链接仍然是最短的那条", () => {
    const meta = planUserMeta("limccn", "https://repovessel.lmlh.net");
    expect(meta.title).toBe("@limccn · Repo Vessel");
    expect(meta.image).toBe("https://repovessel.lmlh.net/og/u/limccn");
  });

  it("本地开发时跟着 localhost 走", () => {
    expect(planUserMeta("limccn", "http://localhost:8787", "zh-Hans").image).toBe(
      "http://localhost:8787/og/u/limccn?lang=zh-Hans",
    );
  });
});

describe("handleUserPage 的测量", () => {
  /* HTMLRewriter 只在 Workers 运行时里存在。这里要测的是「记了什么」，
     不是「改写对不对」—— 一个原样返回的假实现就够。 */
  const written: Array<[string, string, string]> = [];

  class FakeHTMLRewriter {
    on(selector: string, handlers: { element?: (element: FakeElement) => void }): this {
      if (handlers.element) {
        handlers.element({
          setAttribute: (name: string, value: string) => {
            written.push([selector, name, value]);
          },
        });
      }
      return this;
    }

    transform(page: Response): Response {
      return page;
    }
  }

  interface FakeElement {
    setAttribute(name: string, value: string): void;
  }

  const ASSETS = {
    fetch: async () =>
      new Response("<!doctype html><html><head></head><body></body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  };

  function pageRequest(path: string, userAgent?: string): Request {
    const headers: Record<string, string> = {};
    if (userAgent !== undefined) headers["user-agent"] = userAgent;
    return new Request(`https://repovessel.lmlh.net${path}`, { headers });
  }

  const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

  beforeEach(() => {
    written.length = 0;
    vi.stubGlobal("HTMLRewriter", FakeHTMLRewriter);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("分享、爬虫、直访分三笔记，不混成一个数", async () => {
    const fake = createFakeCollectionDb();
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (promise: Promise<unknown>) => void pending.push(promise) };
    const env = { ASSETS } as Env;

    const shared = await handleUserPage(
      { ...env, DB: fake.db },
      pageRequest("/u/limccn?from=share", BROWSER),
      "limccn",
      ctx,
    );
    const crawled = await handleUserPage(
      { ...env, DB: fake.db },
      pageRequest("/u/limccn", "Twitterbot/1.0"),
      "limccn",
      ctx,
    );
    const direct = await handleUserPage(
      { ...env, DB: fake.db },
      pageRequest("/u/limccn", BROWSER),
      "limccn",
      ctx,
    );
    await Promise.all(pending);

    expect([shared.status, crawled.status, direct.status]).toEqual([200, 200, 200]);
    const dims = [...fake.metrics.keys()].map((key) => key.split("|")[2]);
    expect(dims.sort()).toEqual(["src=crawler", "src=direct", "src=share"]);
  });

  it("分享页的 <html lang> 跟着 ?lang= 走", async () => {
    const fake = createFakeCollectionDb();

    await handleUserPage(
      { ASSETS, DB: fake.db } as Env,
      pageRequest("/u/limccn?lang=ja", BROWSER),
      "limccn",
    );

    expect(written).toContainEqual(["html", "lang", "ja"]);
    expect(written).toContainEqual([
      'meta[property="og:image"]',
      "content",
      "https://repovessel.lmlh.net/og/u/limccn?lang=ja",
    ]);
  });

  it("用户名不合法时不记 —— 那不是一次分享页访问", async () => {
    const fake = createFakeCollectionDb();

    const response = await handleUserPage(
      { ASSETS, DB: fake.db } as Env,
      pageRequest("/u/bad--name", BROWSER),
      "bad--name",
    );

    expect(response.status).toBe(200);
    expect(fake.metrics.size).toBe(0);
  });
});
