/**
 * 会话令牌 —— 签名 Cookie 形态，不落库。
 *
 * 令牌是三段式：`v1.<base64url(payload)>.<base64url(hmac)>`，HMAC-SHA256 覆盖
 * 前两段。服务端只验证签名与过期时间，不查询任何存储 —— 登录态是**自证**的，
 * 所以本轮不需要 D1，也不需要会话表。
 *
 * 为什么不在 Cookie 里直接存 GitHub access token：那等于把用户对 GitHub 的
 * 授权凭据放进一个会被浏览器随手带上的地方。这里只放 `id` / `login` /
 * 过期时间，够认人，不够冒充用户去调 GitHub。
 *
 * 签名密钥来自 `SESSION_SECRET`（Wrangler secret）。缺失时**不做降级** ——
 * 用空串或客户端 ID 当密钥，等于没有签名。
 */

import { isLocalePreference, type LocalePreference } from "@/shared/i18n";

export const SESSION_COOKIE = "rv_session";

/** 30 天。到期后重新登录。 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();
const TOKEN_VERSION = "v1";

export interface SessionPayload {
  /** GitHub 数字 id。数字比 login 稳定 —— 用户可以改名。 */
  sub: number;
  login: string;
  /**
   * 语言偏好。可选 —— 没有这个字段的老会话照样有效，按浏览器语言走。
   * 只存 `en` / `zh` / `ja`：中文的简／繁由浏览器地区在客户端解析。
   */
  lang?: LocalePreference;
  /** 签发时间（秒）。 */
  iat: number;
  /** 过期时间（秒）。 */
  exp: number;
}

/* ---------------------------------------------------------------- base64url */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 返回类型写死成 `Uint8Array<ArrayBuffer>`：Web Crypto 的 `BufferSource` 不接受
 * `SharedArrayBuffer` 背后的视图，而 TS 5.9 会把 `new Uint8Array(n)` 推成
 * `Uint8Array<ArrayBufferLike>`。
 */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const raw = atob(remainder === 0 ? padded : padded + "=".repeat(4 - remainder));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/* -------------------------------------------------------------------- hmac */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** 签名一个会话载荷，返回可放进 Cookie 的令牌。 */
export async function signSession(
  payload: SessionPayload,
  secret: string,
): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signed = `${TOKEN_VERSION}.${body}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(signed),
  );
  return `${signed}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * 验证令牌并返回载荷。
 *
 * 任何一项不通过都返回 `null` —— 签名不对、版本不对、结构不对、已过期。
 * 调用方只需要判断真值，不需要区分失败原因（区分了也不该告诉客户端）。
 */
export async function verifySession(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, body, signature] = parts as [string, string, string];
  if (version !== TOKEN_VERSION) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromBase64Url(signature),
      encoder.encode(`${version}.${body}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== "number" ||
    typeof payload.login !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp <= nowSeconds) return null;

  /* 签名是我们自己打的，走到这里的内容不可能被改过；`lang` 认不出来只说明
     它是未来版本写的，丢掉即可 —— 不该因此把用户登出。 */
  if (!isLocalePreference(payload.lang)) delete payload.lang;

  return payload;
}

/** 造一个新会话载荷。 */
export function createSessionPayload(
  user: { id: number; login: string },
  nowSeconds: number = Math.floor(Date.now() / 1000),
  lang?: LocalePreference,
): SessionPayload {
  const payload: SessionPayload = {
    sub: user.id,
    login: user.login,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  if (lang) payload.lang = lang;
  return payload;
}

/**
 * 换语言偏好，别的都不动。
 *
 * 沿用原来的 `iat` / `exp`：改一次语言偏好不该顺手把登录续期 30 天。
 * `null` 表示清掉偏好（回到跟随浏览器）。
 */
export function withLocale(
  payload: SessionPayload,
  lang: LocalePreference | null,
): SessionPayload {
  const next: SessionPayload = {
    sub: payload.sub,
    login: payload.login,
    iat: payload.iat,
    exp: payload.exp,
  };
  if (lang) next.lang = lang;
  return next;
}
