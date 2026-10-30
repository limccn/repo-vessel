/**
 * `/api/auth/*` 与 `DELETE /api/session` 的处理。
 *
 * 失败一律 302 回 `/manage?auth=<原因>`：交互规范 E10 要求「保留当前位置，
 * 不清空任何本地状态」，而登录失败的原因属于**需要用户决策**的信息，
 * 按 §8.4 用内联错误呈现，不用 Toast。原因码只有下面这几个，`/manage` 侧
 * 一一映射成中文文案 —— 原因码本身不进界面。
 */

import { isLocalePreference, type LocalePreference } from "@/shared/i18n";
import type { Env } from "@/worker/env";
import { clearCookie, readCookie, serializeCookie } from "./cookie";
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchUser,
} from "./oauth";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionPayload,
  signSession,
  verifySession,
  withLocale,
} from "./session";

const STATE_COOKIE = "rv_oauth_state";
/** state 只活十分钟 —— 够走完一次授权，短到没有重放价值。 */
const STATE_TTL_SECONDS = 600;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

/** 回调地址：默认由请求 origin 推导，可用 `OAUTH_REDIRECT_URI` 覆盖。 */
function redirectUri(request: Request, env: Env): string {
  const override = env.OAUTH_REDIRECT_URI?.trim();
  if (override) return override;
  return new URL("/api/auth/callback", new URL(request.url).origin).toString();
}

function fail(request: Request, reason: string): Response {
  const url = new URL("/manage", new URL(request.url).origin);
  url.searchParams.set("auth", reason);
  return new Response(null, { status: 302, headers: { location: url.toString() } });
}

/** 32 字节随机数，base64url。 */
function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 已配置好 OAuth 的两把钥匙与签名密钥，缺一不可。 */
function authConfigured(env: Env): boolean {
  return Boolean(
    env.GITHUB_CLIENT_ID?.trim() &&
      env.GITHUB_CLIENT_SECRET?.trim() &&
      env.SESSION_SECRET?.trim(),
  );
}

/* ------------------------------------------------------------ /api/auth/login */

function handleLogin(request: Request, env: Env): Response {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  }
  if (!authConfigured(env)) return fail(request, "unconfigured");

  const state = randomState();
  const location = buildAuthorizeUrl({
    clientId: env.GITHUB_CLIENT_ID!.trim(),
    redirectUri: redirectUri(request, env),
    state,
  });

  return new Response(null, {
    status: 302,
    headers: {
      location,
      "set-cookie": serializeCookie(STATE_COOKIE, state, {
        maxAge: STATE_TTL_SECONDS,
        sameSite: "Lax",
      }),
      "cache-control": "no-store",
    },
  });
}

/* --------------------------------------------------------- /api/auth/callback */

async function handleCallback(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  }
  if (!authConfigured(env)) return fail(request, "unconfigured");

  const url = new URL(request.url);
  const params = url.searchParams;

  // 用户在 GitHub 点了「取消」。这不是错误，是用户的选择。
  if (params.get("error")) return fail(request, "denied");

  const code = params.get("code");
  const state = params.get("state");
  const expected = readCookie(request, STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) {
    return fail(request, "state");
  }

  const exchanged = await exchangeCode({
    clientId: env.GITHUB_CLIENT_ID!.trim(),
    clientSecret: env.GITHUB_CLIENT_SECRET!.trim(),
    code,
    redirectUri: redirectUri(request, env),
  });
  if (!exchanged.ok) {
    return fail(request, exchanged.reason === "denied" ? "denied" : "exchange");
  }

  const user = await fetchUser(exchanged.accessToken);
  if (!user) return fail(request, "profile");

  // 个人账户才认。组织账户没有「这是你的仓库」这回事。
  if (user.type !== "User") return fail(request, "personal-only");

  const token = await signSession(
    createSessionPayload({ id: user.id, login: user.login }),
    env.SESSION_SECRET!.trim(),
  );

  const ok = new URL("/manage", url.origin);
  ok.searchParams.set("auth", "ok");

  const headers = new Headers({
    location: ok.toString(),
    "cache-control": "no-store",
  });
  headers.append(
    "set-cookie",
    serializeCookie(SESSION_COOKIE, token, {
      maxAge: SESSION_TTL_SECONDS,
      sameSite: "Lax",
    }),
  );
  headers.append("set-cookie", clearCookie(STATE_COOKIE));

  return new Response(null, { status: 302, headers });
}

/* ----------------------------------------------------------- /api/auth/session */

async function handleSession(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  }

  const secret = env.SESSION_SECRET?.trim();
  const token = readCookie(request, SESSION_COOKIE);
  const payload =
    secret && token ? await verifySession(token, secret) : null;

  return new Response(
    JSON.stringify({ login: payload?.login ?? null, lang: payload?.lang ?? null }),
    {
      status: payload ? 200 : 401,
      headers: JSON_HEADERS,
    },
  );
}

/* ------------------------------------------------------ POST /api/session/locale */

function badRequest(): Response {
  return new Response(JSON.stringify({ error: "bad-request" }), {
    status: 400,
    headers: JSON_HEADERS,
  });
}

/**
 * 记住语言偏好。
 *
 * 偏好写进**会话 Cookie 本身**（不是 D1）：会话已经是一个只存身份与偏好的
 * 签名令牌，加一个字段不用建表、不用迁移，也不会多出一条能对应到人的记录。
 * 签名沿用原来的过期时间 —— 换语言不该顺手续期。
 *
 * 未登录返回 401：没有会话就没有「你的偏好」这回事，前端据此提示未保存。
 */
async function handleLocale(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  const secret = env.SESSION_SECRET?.trim();
  const token = readCookie(request, SESSION_COOKIE);
  const payload = secret && token ? await verifySession(token, secret) : null;
  if (!secret || !payload) {
    return new Response(JSON.stringify({ error: "not-signed-in" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  /* 读完就解析失败是**请求坏了**，不是「清掉偏好」—— 后者是 `{"lang": null}`，
     一个明确的意图。把两件事混在一起，一次截断的请求就会悄悄改设置。
     所以合法形状只有一种：**非空、非数组、带 `lang` 键的对象**。`null` / `[]` /
     `"x"` / `42` / `{}` 都是请求坏了，一律 400 —— 它们没有「清空」这个意图。 */
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest();
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("lang" in body)
  ) {
    return badRequest();
  }
  const raw = (body as { lang: unknown }).lang;
  let lang: LocalePreference | null = null;
  if (raw !== null) {
    if (!isLocalePreference(raw)) {
      return badRequest();
    }
    lang = raw;
  }

  const next = await signSession(withLocale(payload, lang), secret);
  const remaining = payload.exp - Math.floor(Date.now() / 1000);

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append(
    "set-cookie",
    serializeCookie(SESSION_COOKIE, next, {
      maxAge: Math.max(0, remaining),
      sameSite: "Lax",
    }),
  );
  return new Response(null, { status: 204, headers });
}

/* ----------------------------------------------------------- DELETE /api/session */

function handleLogout(request: Request): Response {
  if (request.method !== "DELETE") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "DELETE" },
    });
  }

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearCookie(SESSION_COOKIE));
  return new Response(null, { status: 204, headers });
}

/* ---------------------------------------------------------------------- router */

/** 命中返回 `Response`，不命中返回 `null`。 */
export function handleAuth(request: Request, env: Env): Response | Promise<Response> | null {
  const path = new URL(request.url).pathname;

  if (path === "/api/auth/login") return handleLogin(request, env);
  if (path === "/api/auth/callback") return handleCallback(request, env);
  if (path === "/api/auth/session") return handleSession(request, env);
  if (path === "/api/session/locale") return handleLocale(request, env);
  if (path === "/api/session") return handleLogout(request);

  return null;
}
