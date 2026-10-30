/**
 * 「现在是谁」—— Worker 侧读当前登录态的**唯一**实现。
 *
 * 会话是签名 Cookie，验证不查任何存储。这里只做两件事：从请求里取出 Cookie，
 * 用 `SESSION_SECRET` 验签。缺密钥、缺 Cookie、签名不对、过期 —— 全部返回
 * `null`，调用方只需要一个真值判断。
 */

import { readCookie } from "./cookie";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";
import type { Env } from "@/worker/env";

export async function currentSession(
  request: Request,
  env: Env,
): Promise<SessionPayload | null> {
  const secret = env.SESSION_SECRET?.trim();
  const token = readCookie(request, SESSION_COOKIE);
  if (!secret || !token) return null;
  return verifySession(token, secret);
}
