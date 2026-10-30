/**
 * Cookie 读写 —— Worker 侧唯一的一处。
 *
 * 只处理 RFC 6265 里本站用到的那一小部分：一个 `name=value` 对、`Path`、
 * `Max-Age`、`HttpOnly`、`Secure`、`SameSite`。不做 URL 编码之外的花样，
 * 因为本站写入的每个值都是 base64url（不含分隔符）。
 */

export interface CookieOptions {
  /** 秒。0 表示立即删除。 */
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/** 从请求头里读一个 Cookie。不存在、解析失败都返回 `null`。 */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return part.slice(index + 1).trim();
  }
  return null;
}

/** 生成一条 `Set-Cookie` 的值。 */
export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions = {},
): string {
  const {
    maxAge,
    path = "/",
    httpOnly = true,
    secure = true,
    sameSite = "Lax",
  } = options;

  const parts = [`${name}=${value}`, `Path=${path}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  parts.push(`SameSite=${sameSite}`);
  return parts.join("; ");
}

/** 删除一条 Cookie（值置空 + `Max-Age=0`）。 */
export function clearCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}
