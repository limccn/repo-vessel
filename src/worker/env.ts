/**
 * Worker 的绑定与变量。
 *
 * 分三类：
 *   - 资源绑定：`DB`（D1）、`ASSETS`（静态产物）
 *   - 明文 `vars`：`REPO_TOPICS`、`GITHUB_CLIENT_ID`（客户端 ID 本来就是公开的）
 *   - **secret**：`GITHUB_CLIENT_SECRET`、`SESSION_SECRET`、`GITHUB_API_TOKEN`
 *     （只走 `wrangler secret put` 或 `.dev.vars`，从不写进 `vars`，也从不入库）
 *
 * `GITHUB_API_TOKEN` 与 OAuth 凭据是**两件事**：前者是站点自己读公开元数据用的
 * classic PAT（零 scope），后者只用来确认「你是谁」。混用会同时坏掉两边 ——
 * 用户的配额被站点消耗，站点的数据又随某一次登录过期而失效。
 */
/**
 * 最小结构声明 —— 项目没有装 `@cloudflare/workers-types`，这里只写真正用到的
 * 那几个成员。装了之后删掉这些接口、换回 `D1Database` / `Fetcher` /
 * `ExecutionContext` 即可。
 */
export interface D1ResultLike<T = unknown> {
  results?: T[];
  success?: boolean;
}

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1ResultLike>;
  all<T = unknown>(): Promise<D1ResultLike<T>>;
}

export interface D1Like {
  prepare(query: string): D1StatementLike;
}

export interface AssetsFetcherLike {
  fetch(request: Request): Promise<Response>;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env {
  /** D1。缓存表 `repo_cache`（M1），后续的收录与认领表在这里。 */
  DB?: D1Like;

  /** 静态产物。`run_worker_first` 之外的路径由它接。 */
  ASSETS?: AssetsFetcherLike;

  /** GitHub 主题列表，逗号分隔。解析规则见 `src/shared/topic.ts`。 */
  REPO_TOPICS?: string;

  /* ---- GitHub OAuth ---- */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  /** 会话签名密钥。缺失时会话端点直接拒绝服务，不降级。 */
  SESSION_SECRET?: string;

  /**
   * 回调地址覆盖。缺省由请求 origin 推导（`<origin>/api/auth/callback`）。
   * 只有在 GitHub 那边登记的回调与站点 origin 不一致时才需要设置。
   */
  OAUTH_REDIRECT_URI?: string;

  /* ---- GitHub 读取 ---- */

  /**
   * 服务端读取令牌 —— classic PAT，**零 scope**。
   *
   * 零 scope 的 classic PAT 等于「身份已认证的匿名访客」：能读公开数据、拿
   * 5000 次/小时，但没有任何私有或写权限。不用 fine-grained（按资源归属授权，
   * 读不了任意用户的公开仓库），也不用 `public_repo`（含写权限）。
   *
   * 缺失时所有读取接口直接返回 `upstream_unavailable`，**不回落匿名请求** ——
   * 匿名配额在共享出口 IP 上没有意义，静默回落只会表现为「时好时坏」。
   */
  GITHUB_API_TOKEN?: string;
}
