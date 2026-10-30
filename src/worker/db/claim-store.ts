/**
 * `repo_claim` 的读写。
 *
 * 认领只记录「谁证明了这个仓库是自己的」，不记录展示状态 —— 隐藏仍然在
 * `collected_repo.hidden_by` 上。两张表分开，是因为匿名下架也要能隐藏，
 * 而它没有认领记录。
 *
 * 读失败**不吞**：认领页把一个读不到的状态画成「未认领」，等于让所有者
 * 以为自己的认领丢了。
 */

import type { D1Like } from "@/worker/env";
import type { HiddenBy, RepoClaimRow, VerifyState } from "./schema";

export async function readClaim(
  db: D1Like,
  fullName: string,
): Promise<RepoClaimRow | null> {
  return db
    .prepare("SELECT * FROM repo_claim WHERE full_name = ?")
    .bind(fullName)
    .first<RepoClaimRow>();
}

/** 新建或改认领人。一个仓库只认一个所有者 —— 同名账号不可能被两个人拥有。 */
export async function writeClaim(
  db: D1Like,
  fullName: string,
  login: string,
  at: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO repo_claim (full_name, login, claimed_at, updated_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(full_name) DO UPDATE SET login = excluded.login, updated_at = excluded.updated_at",
    )
    .bind(fullName, login.trim().toLowerCase(), at, at)
    .run();
}

export async function deleteClaim(db: D1Like, fullName: string): Promise<void> {
  await db.prepare("DELETE FROM repo_claim WHERE full_name = ?").bind(fullName).run();
}

/** 某个登录名认领的全部仓库。管理页按它列出来。 */
export async function listClaimsByLogin(
  db: D1Like,
  login: string,
): Promise<RepoClaimRow[]> {
  const result = await db
    .prepare("SELECT * FROM repo_claim WHERE login = ? ORDER BY claimed_at DESC")
    .bind(login.trim().toLowerCase())
    .all<RepoClaimRow>();
  return result.results ?? [];
}

/** 认领 + 仓库当前的展示状态。左侧连接：仓库行没了也照样列出这条认领。 */
export interface ManageableClaimRow {
  full_name: string;
  claimed_at: string;
  verify_state: VerifyState | null;
  hidden_by: HiddenBy | null;
  verified_at: string | null;
}

export async function listManageableClaims(
  db: D1Like,
  login: string,
): Promise<ManageableClaimRow[]> {
  const result = await db
    .prepare(
      "SELECT c.full_name AS full_name, c.claimed_at AS claimed_at, " +
        "r.verify_state AS verify_state, r.hidden_by AS hidden_by, " +
        "r.verified_at AS verified_at " +
        "FROM repo_claim c LEFT JOIN collected_repo r ON r.full_name = c.full_name " +
        "WHERE c.login = ? ORDER BY c.claimed_at DESC",
    )
    .bind(login.trim().toLowerCase())
    .all<ManageableClaimRow>();
  return result.results ?? [];
}
