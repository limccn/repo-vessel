/**
 * `GET /api/repos/:owner/:repo`
 *
 * 只返回一个仓库的元数据。它是仓库详情与分享卡的共同数据源，也是 Fork 上游
 * 的可靠来源 —— 单仓库响应一定带 `parent`。
 */

import type { Envelope, RepoSummary } from "@/shared/contract";
import { REPO_CACHE_TTL_SECONDS, isExpired, repoCacheKey } from "@/worker/cache/ttl";
import { cacheGet, cacheSet } from "@/worker/cache/store";
import { toRepoSummary } from "@/worker/derive/summary";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { GitHubError } from "@/worker/github/client";
import { getRepo } from "@/worker/github/repos";
import { isValidUsername } from "./inspect";
import { fromGitHubError, jsonEnvelope, jsonError, makeError } from "./respond";

/** 仓库名允许的字符集。形态不对就不发请求。 */
export function isValidRepoName(name: string): boolean {
  return /^[\w.-]{1,100}$/.test(name);
}

async function readRepo(
  env: Env,
  owner: string,
  name: string,
): Promise<Envelope<RepoSummary>> {
  const repo = await getRepo(env, owner, name);
  if (repo.private === true) {
    // 私有仓库按「读不到」处理，不确认它是否存在。
    throw new GitHubError("not-found", 404);
  }
  const readAt = new Date().toISOString();
  return {
    data: toRepoSummary(repo, readAt),
    completeness: "complete",
    missingPages: [],
    readAt,
  };
}

export async function handleRepo(
  env: Env,
  ctx: ExecutionContextLike | undefined,
  rawOwner: string,
  rawName: string,
  topics: readonly string[],
): Promise<Response> {
  const owner = rawOwner.trim();
  const name = rawName.trim();

  if (!isValidUsername(owner) || !isValidRepoName(name)) {
    return jsonError(makeError("repo_unavailable"), { topics, status: 404 });
  }

  const key = repoCacheKey(owner, name);
  const cached = await cacheGet(env.DB, key);
  if (cached) {
    try {
      const envelope = JSON.parse(cached.payload) as Envelope<RepoSummary>;
      if (!isExpired(cached.fetchedAt, REPO_CACHE_TTL_SECONDS)) {
        return jsonEnvelope(envelope, { topics });
      }
      if (ctx) {
        ctx.waitUntil(
          readRepo(env, owner, name)
            .then((fresh) => cacheSet(env.DB, key, fresh, fresh.readAt ?? new Date().toISOString()))
            .catch(() => undefined),
        );
      }
      return jsonEnvelope(envelope, { topics });
    } catch {
      /* 缓存坏了 —— 当作未命中。 */
    }
  }

  try {
    const envelope = await readRepo(env, owner, name);
    if (ctx) {
      ctx.waitUntil(cacheSet(env.DB, key, envelope, envelope.readAt ?? new Date().toISOString()));
    } else {
      await cacheSet(env.DB, key, envelope, envelope.readAt ?? new Date().toISOString());
    }
    return jsonEnvelope(envelope, { topics });
  } catch (error) {
    return jsonError(fromGitHubError(error, "repo_unavailable"), { topics });
  }
}
