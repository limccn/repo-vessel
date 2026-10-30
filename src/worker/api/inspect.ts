/**
 * `GET /api/inspect/:username`
 *
 * 顺序：校验 → 缓存 → 读取 → 派生 → 组装 → 写缓存。
 *
 * 缓存命中分两种：
 *   - 未过期：直接返回。`readAt` 是**抓取时间**，不是此刻 —— 界面上的
 *     「数据截至 X」才对得上。
 *   - 已过期：仍然直接返回旧信封（它的 `completeness` 描述的是那次读取，
 *     不该因为「旧」就被改写成 `partial` —— 旧不等于不完整），同时用
 *     `waitUntil` 在后台刷新，用户不必等。
 */

import type { ApiError, Envelope, InspectPayload, RepoSummary } from "@/shared/contract";
import type { Locale } from "@/shared/i18n";
import { USER_CACHE_TTL_SECONDS, isExpired, userCacheKey } from "@/worker/cache/ttl";
import { cacheGet, cacheSet } from "@/worker/cache/store";
import { buildCounts } from "@/worker/derive/stats";
import { toRepoSummary } from "@/worker/derive/summary";
import { deriveTitle } from "@/worker/derive/title";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { recordMetric } from "@/worker/db/metrics-store";
import { resolveUpstreams } from "@/worker/github/repos";
import { getUser, listOwnedRepos } from "@/worker/github/users";
import type { GitHubRepo } from "@/worker/github/users";
import { fromGitHubError, jsonEnvelope, jsonError, makeError } from "./respond";

/**
 * GitHub 用户名的形态：字母数字与单个连字符，不以连字符开头或结尾，最长 39。
 * 形态不对就**不发请求** —— 把明显无效的输入送上游只是浪费配额。
 */
export function isValidUsername(username: string): boolean {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(username);
}

function representativesOf(repos: RepoSummary[]): InspectPayload["representatives"] {
  let longestDormant: RepoSummary | null = null;
  let brightestEmber: RepoSummary | null = null;
  let travelledFork: RepoSummary | null = null;

  for (const repo of repos) {
    if (
      repo.dormantDays !== null &&
      (longestDormant === null ||
        repo.dormantDays > (longestDormant.dormantDays ?? -1))
    ) {
      longestDormant = repo;
    }

    if (repo.tags.includes("ember") && repo.starCount !== null) {
      if (brightestEmber === null || (brightestEmber.starCount ?? -1) < repo.starCount) {
        brightestEmber = repo;
      }
    }

    if (repo.isFork === true) {
      const candidate = repo.upstream?.lastPushedAt ?? null;
      const current = travelledFork?.upstream?.lastPushedAt ?? null;
      if (travelledFork === null) travelledFork = repo;
      else if (
        candidate !== null &&
        (current === null || Date.parse(candidate) < Date.parse(current))
      ) {
        travelledFork = repo;
      }
    }
  }

  return { longestDormant, brightestEmber, travelledFork };
}

function buildEnvelope(
  account: { login: string; type: "User" | "Organization"; avatarUrl: string | null },
  read: Awaited<ReturnType<typeof listOwnedRepos>>,
  topics: readonly string[],
  locale: Locale,
  readAt: string,
): Envelope<InspectPayload> {
  const repos: RepoSummary[] = read.repos.map((repo: GitHubRepo) =>
    toRepoSummary(repo, readAt),
  );
  const complete = read.missingPages.length === 0 && !read.truncated;
  const counts = buildCounts({ repos, topics, complete });

  return {
    data: {
      account,
      repoCount: counts.repoCount,
      enrolledCount: counts.enrolledCount,
      stats: counts.stats,
      title: deriveTitle(repos, counts.repoCount, locale),
      representatives: representativesOf(repos),
      repos,
      reposTruncated: read.truncated,
    },
    completeness: complete ? "complete" : "partial",
    missingPages: read.missingPages,
    readAt,
  };
}

/** 账户本身不该被查询 —— 与上游失败分开，因为它是产品规则，不是故障。 */
class AccountRejected extends Error {
  constructor(readonly code: "account_is_organization") {
    super(code);
    this.name = "AccountRejected";
  }
}

async function readAccount(
  env: Env,
  login: string,
  topics: readonly string[],
  locale: Locale,
): Promise<Envelope<InspectPayload>> {
  const user = await getUser(env, login);
  const account = {
    login: user.login,
    type: user.type === "Organization" ? ("Organization" as const) : ("User" as const),
    avatarUrl: user.avatar_url ?? null,
  };

  // 个人账户之外一律不读仓库：组织、Bot、企业账号都不是「个人公开仓库」。
  if (account.type !== "User") {
    throw new AccountRejected("account_is_organization");
  }

  const read = await listOwnedRepos(env, login);
  // 列表接口不带 `parent`，Fork 的上游要逐仓库补读（有上限，失败保持 unresolved）。
  await resolveUpstreams(env, read.repos);
  const readAt = new Date().toISOString();
  return buildEnvelope(account, read, topics, locale, readAt);
}

/** 「缓存 → 读取」的结果。失败时**没有**信封 —— 失败的读取没有数据，也没有读取时间。 */
export type InspectLoad =
  | { ok: true; envelope: Envelope<InspectPayload> }
  | { ok: false; error: ApiError };

/**
 * `/api/inspect` 与 `/og/u/:username` 共用的取数路径。
 *
 * 两个出口读同一份数据、同一个 `readAt` —— OG 图上的「读取于 X」与页面上那句
 * 是同一个时刻。调用方只决定怎么**呈现**失败：接口回错误信封，图照画、数字写未知。
 *
 * `locale` 进缓存键：信封里的称号与证据是**已翻译的句子**，所以语言是这份
 * 数据的一部分，不是呈现参数。
 */
export async function loadInspectEnvelope(
  env: Env,
  ctx: ExecutionContextLike | undefined,
  username: string,
  topics: readonly string[],
  locale: Locale,
): Promise<InspectLoad> {
  const key = userCacheKey(username, locale);
  const cached = await cacheGet(env.DB, key);

  if (cached) {
    try {
      const envelope = JSON.parse(cached.payload) as Envelope<InspectPayload>;
      if (!isExpired(cached.fetchedAt, USER_CACHE_TTL_SECONDS)) {
        return { ok: true, envelope };
      }
      // 过期：先给旧数据，后台刷新。
      if (ctx) {
        ctx.waitUntil(
          readAccount(env, username, topics, locale)
            .then((fresh) => cacheSet(env.DB, key, fresh, fresh.readAt ?? new Date().toISOString()))
            .catch(() => undefined),
        );
      }
      return { ok: true, envelope };
    } catch {
      /* 缓存内容坏了 —— 当作没有缓存，往下走实时读取。 */
    }
  }

  try {
    const envelope = await readAccount(env, username, topics, locale);
    const written = cacheSet(env.DB, key, envelope, envelope.readAt ?? new Date().toISOString());
    if (ctx) ctx.waitUntil(written);
    else await written;
    return { ok: true, envelope };
  } catch (error) {
    if (error instanceof AccountRejected) {
      return { ok: false, error: makeError(error.code, { reason: "is_org" }) };
    }
    return { ok: false, error: fromGitHubError(error, "account_not_found") };
  }
}

export async function handleInspect(
  env: Env,
  ctx: ExecutionContextLike | undefined,
  rawUsername: string,
  topics: readonly string[],
  locale: Locale,
): Promise<Response> {
  const username = rawUsername.trim();
  if (!isValidUsername(username)) {
    void recordMetric(env, "inspect_read", "failed:invalid_username", 1, ctx);
    return jsonError(makeError("invalid_username"), { topics, status: 400 });
  }

  const loaded = await loadInspectEnvelope(env, ctx, username, topics, locale);
  if (loaded.ok) {
    /* 成功读取的 `completeness` 只有 complete / partial；OG 图走的是
       `loadInspectEnvelope`，不经过这里，不会被算成一次查询。 */
    if (loaded.envelope.completeness !== "failed") {
      void recordMetric(env, "inspect_read", loaded.envelope.completeness, 1, ctx);
    }
    return jsonEnvelope(loaded.envelope, { topics });
  }

  void recordMetric(env, "inspect_read", `failed:${loaded.error.code}`, 1, ctx);
  return jsonError(loaded.error, { topics });
}
