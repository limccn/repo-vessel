/**
 * 登录态 —— 只问 Worker 一个问题：现在是谁。
 *
 * 会话是 HttpOnly 的签名 Cookie，前端读不到、也不需要读；`/api/auth/session`
 * 就是唯一的真相来源。没有会话、请求失败、Worker 还没部署，一律当作**未登录**
 * —— 未登录是可用的默认态，不是错误态。
 */

import { isLocalePreference, type LocalePreference } from "@/shared/i18n";

export interface SessionInfo {
  login: string;
  /** 会话里记着的语言偏好。没选过就是 `null` —— 那时界面跟随浏览器。 */
  lang: LocalePreference | null;
}

/** 当前登录名与语言偏好。未登录返回 `null`。 */
export async function fetchSession(
  signal?: AbortSignal,
): Promise<SessionInfo | null> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { login?: unknown; lang?: unknown };
    if (typeof body.login !== "string") return null;
    return {
      login: body.login,
      lang: isLocalePreference(body.lang) ? body.lang : null,
    };
  } catch {
    return null;
  }
}

/**
 * 记住语言偏好（写进签名会话 Cookie）。
 *
 * `null` 表示清掉偏好、回到跟随浏览器。返回 `false` 只说明**没有存到服务端**
 * —— 这一次的界面仍然已经换成新语言了，所以调用方把它当提示，不当失败。
 */
export async function saveLocalePreference(
  lang: LocalePreference | null,
): Promise<boolean> {
  try {
    const response = await fetch("/api/session/locale", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 结束会话。失败也返回 —— Cookie 到期后同样失效，前端没有可补救的动作。
 */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch {
    /* 忽略：会话到期也会失效。 */
  }
}

/** 去 GitHub 授权。整页跳转，不是 XHR —— 登录不能由脚本代劳。 */
export const SIGN_IN_URL = "/api/auth/login";
