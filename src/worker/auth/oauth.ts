/**
 * GitHub OAuth 的三次外部调用：拼授权地址、换 token、读用户。
 *
 * 边界（`CLAUDE.md` + `github-boundaries.md`）：
 *   - 作用域只有 `read:user`。**不申请** `repo`、不申请任何写权限。
 *   - 对 GitHub 只有 `GET`，唯一例外是换 token 的那次 `POST /login/oauth/access_token`
 *     —— 那是 OAuth 协议本身的一步，不是对用户仓库的写操作。
 *   - 不读仓库内容，只读身份。
 */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

/** 只读身份。少了它拿不到 `/user`；多了任何一个都是越界。 */
export const OAUTH_SCOPE = "read:user";

/** 每次请求都带。GitHub 会拒绝没有 User-Agent 的请求。 */
const USER_AGENT = "repo-vessel";

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPE);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export type ExchangeResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "denied" | "upstream" };

/**
 * 用一次性 code 换 access token。
 *
 * GitHub 在授权被拒时用 `200` + `error=access_denied` 返回，所以不能只看状态码。
 */
export async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<ExchangeResult> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
      }),
    });
  } catch {
    return { ok: false, reason: "upstream" };
  }

  if (!response.ok) return { ok: false, reason: "upstream" };

  let body: { access_token?: unknown; error?: unknown };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return { ok: false, reason: "upstream" };
  }

  if (typeof body.access_token === "string" && body.access_token.length > 0) {
    return { ok: true, accessToken: body.access_token };
  }
  return { ok: false, reason: "denied" };
}

export interface GitHubUser {
  id: number;
  login: string;
  /** `User` 或 `Organization`。本站只接受个人账户。 */
  type: string;
}

/** 读取当前 token 对应的身份。 */
export async function fetchUser(
  accessToken: string,
): Promise<GitHubUser | null> {
  let response: Response;
  try {
    response = await fetch(USER_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as Partial<GitHubUser> | null;
  if (!body || typeof body.id !== "number" || typeof body.login !== "string") {
    return null;
  }
  return {
    id: body.id,
    login: body.login,
    type: typeof body.type === "string" ? body.type : "User",
  };
}
