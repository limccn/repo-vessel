/**
 * `GET /api/claims` —— 管理页的列表：我认领了哪些仓库，它们现在是什么样子。
 *
 * 需要登录。列表里每一条都自带「能不能操作」：仓库掉了（下架、私有化）之后
 * 认领记录仍然在，但它已经不是一个可以隐藏的东西 —— 那一条只能看，不能点。
 */

import type { ClaimsPayload, ManageClaim } from "@/shared/contract";
import { currentSession } from "@/worker/auth/current";
import { listManageableClaims } from "@/worker/db/claim-store";
import type { Env } from "@/worker/env";
import { jsonEnvelope, jsonError, makeError } from "./respond";

export async function handleMyClaims(
  request: Request,
  env: Env,
  topics: readonly string[],
): Promise<Response> {
  const session = await currentSession(request, env);
  if (!session) {
    return jsonError(makeError("auth_failed"), { topics, status: 401 });
  }

  if (!env.DB) {
    return jsonError(
      makeError("upstream_unavailable", { message: "认领记录暂时读不到。稍后再试。" }),
      { topics },
    );
  }

  let claims: ManageClaim[];
  try {
    const rows = await listManageableClaims(env.DB, session.login);
    claims = rows.map((row) => ({
      fullName: row.full_name,
      claimedAt: row.claimed_at,
      hidden: row.hidden_by !== null,
      manageable: row.verify_state === "verified",
      verifiedAt: row.verified_at,
    }));
  } catch {
    /* 读不到 ≠ 没有认领 —— 画成空列表会让所有者以为认领丢了。 */
    return jsonError(
      makeError("upstream_unavailable", { message: "认领记录暂时读不到。稍后再试。" }),
      { topics },
    );
  }

  const payload: ClaimsPayload = { claims };
  return jsonEnvelope(
    { data: payload, completeness: "complete", missingPages: [], readAt: new Date().toISOString() },
    { topics },
  );
}
