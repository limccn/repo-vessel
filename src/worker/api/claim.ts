/**
 * `/api/claim/:owner/:repo` —— 认领与隐藏。
 *
 * 三条路由，全部需要登录：
 *   GET    当前账户在这个仓库上的状态（未认领也是 200，不是 403）
 *   POST   四项校验，通过则写下认领
 *   PATCH  `{ hidden: boolean }`，只能改自己认领的那一条
 *
 * **认领不创建收录权。** 只有已经核实、还在龛里的仓库才认领得上；下架的仓库
 * 认领不了（`not_enrolled`）—— 那不是一个可以隐藏的东西，而是一个已经不在的东西。
 *
 * 四项校验的**顺序**是有意义的：先说「这不是你的」，再说「它不在龛里」，
 * 最后才是「它是组织 / 私有」。用户看到的第一个原因应该是最该先改的那一个。
 */

import type { ClaimPayload, ClaimRejection, Envelope } from "@/shared/contract";
import { bustVisibility } from "@/worker/cache/invalidate";
import { readClaim, writeClaim } from "@/worker/db/claim-store";
import { readCollected, setHidden } from "@/worker/db/collect-store";
import {
  normalizeFullName,
  type CollectedRepoRow,
  type RepoClaimRow,
} from "@/worker/db/schema";
import type { Env, ExecutionContextLike } from "@/worker/env";
import { currentSession } from "@/worker/auth/current";
import { recordMetric } from "@/worker/db/metrics-store";
import { getRepo } from "@/worker/github/repos";
import { isValidUsername } from "./inspect";
import { isValidRepoName } from "./repo";
import { jsonEnvelope, jsonError, makeError } from "./respond";

/** 请求体上限。认领与隐藏的请求体只有几个字段，4 KB 已经非常宽松。 */
const MAX_BODY_BYTES = 4 * 1024;

const REJECTION_MESSAGES: Record<ClaimRejection, string> = {
  not_owner: "这个仓库不属于当前登录的账户。",
  is_org: "组织账户的仓库不会被收录，也无法认领。",
  not_public: "这个仓库不是公开仓库。",
  not_enrolled: "这个仓库目前没有被收录。",
};

function rejected(reason: ClaimRejection, topics: readonly string[]): Response {
  return jsonError(
    makeError("claim_rejected", { reason, message: REJECTION_MESSAGES[reason] }),
    { topics },
  );
}

function payloadOf(
  fullName: string,
  claimed: boolean,
  hidden: boolean,
  claimedAt: string | null,
  manageable: boolean,
): Envelope<ClaimPayload> {
  return {
    data: { fullName, claimed, hidden, claimedAt, manageable },
    completeness: "complete",
    missingPages: [],
    readAt: new Date().toISOString(),
  };
}

/** 一行仓库是否还具备「可以被隐藏 / 恢复」的资格。 */
function displayable(row: CollectedRepoRow | null): row is CollectedRepoRow {
  return row !== null && row.verify_state === "verified";
}

export interface ClaimRouteInput {
  owner: string;
  name: string;
  topics: readonly string[];
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function handleClaim(
  request: Request,
  env: Env,
  { owner: rawOwner, name: rawName, topics }: ClaimRouteInput,
  ctx?: ExecutionContextLike,
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "POST" && method !== "PATCH") {
    return jsonError(
      makeError("client_unsupported", { message: "这个接口只支持 GET、POST 与 PATCH。" }),
      { topics, status: 405 },
    );
  }

  /* 认领与隐藏的成功率按「尝试 → 结果」计。GET 是读状态，不是一次操作，
     所以不记；方法/参数错误也不是一次真实的尝试，同样不记。 */
  const record = (dim: string): void => {
    void recordMetric(env, "claim_action", dim, 1, ctx);
  };
  const reject = (reason: ClaimRejection, action: "claim" | "restore" = "claim"): Response => {
    record(`${action}:${reason}`);
    return rejected(reason, topics);
  };

  if (!isValidUsername(rawOwner.trim()) || !isValidRepoName(rawName.trim())) {
    return jsonError(makeError("invalid_payload", { message: "仓库名要写成 owner/name。" }), {
      topics,
      status: 400,
    });
  }

  const fullName = normalizeFullName(`${rawOwner}/${rawName}`);
  if (fullName === null) {
    return jsonError(makeError("invalid_payload", { message: "仓库名要写成 owner/name。" }), {
      topics,
      status: 400,
    });
  }

  const session = await currentSession(request, env);
  if (!session) {
    return jsonError(makeError("auth_failed"), { topics, status: 401 });
  }

  const login = session.login.trim().toLowerCase();
  const owner = fullName.split("/")[0] ?? "";
  const isOwner = login === owner;

  let row: CollectedRepoRow | null = null;
  if (env.DB) {
    try {
      row = await readCollected(env.DB, fullName);
    } catch {
      return jsonError(makeError("upstream_unavailable", { message: "收录数据暂时读不到。稍后再试。" }), {
        topics,
      });
    }
  }

  let claim: RepoClaimRow | null = null;
  if (env.DB) {
    try {
      claim = await readClaim(env.DB, fullName);
    } catch {
      return jsonError(makeError("upstream_unavailable", { message: "认领记录暂时读不到。稍后再试。" }), {
        topics,
      });
    }
  }

  const myClaim = claim !== null && claim.login === login ? claim : null;
  const claimedByMe = myClaim !== null;
  const hidden = row?.hidden_by != null;

  /* ------------------------------------------------------------------ GET */

  if (method === "GET") {
    return jsonEnvelope(
      payloadOf(
        fullName,
        claimedByMe,
        hidden,
        myClaim?.claimed_at ?? null,
        claimedByMe && displayable(row),
      ),
      { topics },
    );
  }

  /* ----------------------------------------------------------------- POST */

  if (method === "POST") {
    if (!isOwner) return reject("not_owner");
    if (!displayable(row)) return reject("not_enrolled");

    /* 历史行缺字段时补读一次；读不到就如实报上游错误，不放行。 */
    if (row.owner_type === null || row.is_private === null) {
      let live;
      try {
        live = await getRepo(env, owner, fullName.split("/")[1] ?? "");
      } catch {
        /* **读不到不是「是个人、是公开」** —— 不放行，也不猜原因。 */
        record("claim:error:upstream_unavailable");
        return jsonError(
          makeError("upstream_unavailable", {
            message: "暂时确认不了这个仓库的状态，稍后再试。",
          }),
          { topics },
        );
      }
      if (live.owner?.type !== "User") return reject("is_org");
      if (live.private === true) return reject("not_public");
    } else {
      if (row.owner_type !== "User") return reject("is_org");
      if (row.is_private === 1) return reject("not_public");
    }

    const at = new Date().toISOString();
    if (!env.DB) {
      record("claim:error:upstream_unavailable");
      return jsonError(makeError("upstream_unavailable", { message: "收录数据暂时读不到。稍后再试。" }), {
        topics,
      });
    }
    await writeClaim(env.DB, fullName, login, at);
    record("claim:ok");

    return jsonEnvelope(payloadOf(fullName, true, hidden, at, true), { topics });
  }

  /* ---------------------------------------------------------------- PATCH */

  if (!myClaim) {
    record("claim:not_owner");
    return jsonError(
      makeError("claim_rejected", {
        reason: "not_owner",
        message: "你还没有认领这个仓库。",
      }),
      { topics },
    );
  }

  const body = await readBody(request);
  const wanted =
    typeof body === "object" && body !== null
      ? (body as { hidden?: unknown }).hidden
      : undefined;
  if (typeof wanted !== "boolean") {
    return jsonError(makeError("invalid_payload", { message: "请求里要有 hidden 字段（true 或 false）。" }), {
      topics,
      status: 400,
    });
  }

  if (!env.DB) {
    record(`${wanted ? "hide" : "restore"}:error:upstream_unavailable`);
    return jsonError(makeError("upstream_unavailable", { message: "收录数据暂时读不到。稍后再试。" }), {
      topics,
    });
  }

  const at = new Date().toISOString();

  if (wanted) {
    // 隐藏是幂等的，也不要求仓库当前仍满足收录条件 —— 想拿掉就拿掉。
    await setHidden(env.DB, fullName, "owner", at);
    await bustVisibility(env.DB, owner, login);
    record("hide:ok");
    return jsonEnvelope(payloadOf(fullName, true, true, myClaim.claimed_at, displayable(row)), {
      topics,
    });
  }

  /* 恢复：它必须**现在**仍然具备收录条件，否则恢复出来的是一条不该展示的记录。 */
  if (!displayable(row)) return reject("not_enrolled", "restore");

  await setHidden(env.DB, fullName, null, at);
  await bustVisibility(env.DB, owner, login);
  record("restore:ok");
  return jsonEnvelope(payloadOf(fullName, true, false, myClaim.claimed_at, true), { topics });
}
