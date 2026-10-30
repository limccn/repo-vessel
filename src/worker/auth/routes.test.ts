// @vitest-environment node
/**
 * 语言偏好这条路由（`POST /api/session/locale`）。
 *
 * 它改的是**会话本身**：签新 Cookie、沿用原来的过期时间、别的字段一个不动。
 * 这里钉住的是几件容易悄悄坏掉的事 —— 没登录不能写、坏值不能落进 Cookie、
 * 清偏好是删字段而不是写空串、换语言不顺手续期。
 */
import { describe, expect, it } from "vitest";
import { handleAuth } from "./routes";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionPayload,
  signSession,
  verifySession,
} from "./session";
import type { Env } from "@/worker/env";

const SECRET = "test-secret-do-not-use-anywhere-else";
const ENV: Env = { SESSION_SECRET: SECRET };
const URL = "https://example.test/api/session/locale";

/**
 * 一枚**当前时间**签发的会话 —— 路由内部按真实时钟验签，所以测试不能用
 * 1970 年的固定时间，否则每一条都会先过期。
 */
async function signedSession(lang?: "en" | "zh" | "ja") {
  const now = Math.floor(Date.now() / 1000);
  const payload = createSessionPayload({ id: 42, login: "alice" }, now, lang);
  const token = await signSession(payload, SECRET);
  return { payload, cookie: `${SESSION_COOKIE}=${token}` };
}

async function cookieFor(lang?: "en" | "zh" | "ja"): Promise<string> {
  return (await signedSession(lang)).cookie;
}

function post(body: unknown, cookie?: string): Request {
  return new Request(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function issuedToken(response: Response): string | null {
  const header = response.headers.get("set-cookie");
  if (!header) return null;
  const first = header.split(";")[0] ?? "";
  return first.slice(SESSION_COOKIE.length + 1);
}

describe("POST /api/session/locale", () => {
  it("没登录就是 401，不发 Cookie", async () => {
    const response = (await handleAuth(post({ lang: "ja" }), ENV)) as Response;

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("记住偏好：新令牌里带 lang，身份与过期时间不变", async () => {
    const original = await signedSession();
    const response = (await handleAuth(post({ lang: "ja" }, original.cookie), ENV)) as Response;
    expect(response.status).toBe(204);

    const payload = await verifySession(issuedToken(response), SECRET);

    expect(payload?.lang).toBe("ja");
    expect(payload?.login).toBe("alice");
    expect(payload?.sub).toBe(42);
    /* 换语言不该顺手续期：`exp` 与 `iat` 还是会话最初那两个。 */
    expect(payload?.exp).toBe(original.payload.exp);
    expect(payload?.iat).toBe(original.payload.iat);
  });

  it("`null` 清掉偏好，回到跟随浏览器", async () => {
    const response = (await handleAuth(
      post({ lang: null }, await cookieFor("ja")),
      ENV,
    )) as Response;
    expect(response.status).toBe(204);

    const payload = await verifySession(issuedToken(response), SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.lang).toBeUndefined();
  });

  it("认不出的偏好是 400，且不改动会话", async () => {
    const response = (await handleAuth(
      post({ lang: "zh-Hant" }, await cookieFor()),
      ENV,
    )) as Response;

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("请求体坏了是 400，不会顺手清掉偏好", async () => {
    const response = (await handleAuth(
      new Request(URL, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: await cookieFor("ja") },
        body: "{",
      }),
      ENV,
    )) as Response;

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  /* 合法 JSON 但形状不对，同样属于「请求坏了」。尤其 `{}` 与 `null`：
     它们没有「我要清空偏好」这个意图，只有 `{"lang": null}` 有。 */
  it.each([[null], [[]], [{}], ["ja"], [42]])(
    "不是带 lang 的对象就 400，不改动会话：%j",
    async (body) => {
      const response = (await handleAuth(post(body, await cookieFor("ja")), ENV)) as Response;

      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it("只接受 POST", async () => {
    const response = (await handleAuth(
      new Request(URL, { method: "GET", headers: { cookie: await cookieFor() } }),
      ENV,
    )) as Response;

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});

describe("GET /api/auth/session", () => {
  it("把偏好一并交回前端", async () => {
    const response = (await handleAuth(
      new Request("https://example.test/api/auth/session", {
        headers: { cookie: await cookieFor("zh") },
      }),
      ENV,
    )) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ login: "alice", lang: "zh" });
  });

  it("没有偏好时是 null，不是空串", async () => {
    const response = (await handleAuth(
      new Request("https://example.test/api/auth/session", {
        headers: { cookie: await cookieFor() },
      }),
      ENV,
    )) as Response;

    await expect(response.json()).resolves.toEqual({ login: "alice", lang: null });
  });
});

describe("会话过期", () => {
  it("过期令牌不能改偏好", async () => {
    const token = await signSession(createSessionPayload({ id: 42, login: "alice" }, 1_000), SECRET);
    const cookie = `${SESSION_COOKIE}=${token}`;
    /* 路由内部按真实时间验签，令牌是 1970 年 1000 秒签的 —— 早就过期了。 */
    const response = (await handleAuth(post({ lang: "ja" }, cookie), ENV)) as Response;
    expect(response.status).toBe(401);
  });

  it("TTL 是 30 天", () => {
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 30);
  });
});
