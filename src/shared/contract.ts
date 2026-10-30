/**
 * The wire types. Imported by the Worker **and** the SPA — never re-declared on either side.
 *
 * Source of truth: `.trellis/spec/backend/api-contract.md` §1/§4, mirrored by
 * `.trellis/spec/frontend/type-safety.md`.
 */

/** A read that finished / a read that finished partially / a read that failed. */
export type Completeness = "complete" | "partial" | "failed";

export interface Envelope<T> {
  data: T | null;
  completeness: Completeness;
  /** Page numbers that could not be read. Empty on a complete read. */
  missingPages: number[];
  /** ISO-8601 UTC. `null` when the read failed — a failed read has no read time. */
  readAt: string | null;
}

export type ErrorCode =
  | "rate_limited"
  | "upstream_timeout"
  | "upstream_unavailable"
  | "account_not_found"
  | "account_is_organization"
  | "repo_unavailable"
  | "repo_delisted"
  | "card_render_failed"
  | "auth_failed"
  | "claim_rejected"
  | "client_unsupported"
  | "offline"
  | "invalid_username"
  | "invalid_board"
  | "invalid_payload"
  | "payload_too_large";

export interface ApiError {
  code: ErrorCode;
  /** User-facing Chinese. Owned by the backend — the client renders it verbatim. */
  message: string;
  /** Epoch seconds. `rate_limited` only. */
  retryAfter?: number;
  reason?: ClaimRejection;
}

export interface ErrorEnvelope extends Envelope<never> {
  completeness: "failed";
  error: ApiError;
}

/* -------------------------------------------------------------------------- */
/* The three-state field model                                                */
/* -------------------------------------------------------------------------- */

export type UnknownReason =
  | "rate-limited"
  | "timeout"
  | "not-provided"
  | "unreachable"
  | "truncated";

export type FieldState =
  | { kind: "value"; value: string }
  | { kind: "unknown"; reason: UnknownReason }
  | { kind: "na" };

/* -------------------------------------------------------------------------- */
/* The upstream triple                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `org` is the upstream's own account type — org upstreams are named but never read.
 * `unresolved` = we could not determine where it came from.
 * `unreachable` = we know where it came from but could not read it.
 */
export type UpstreamState = "personal" | "org" | "unresolved" | "unreachable";

export interface Upstream {
  state: UpstreamState;
  owner: string | null;
  repo: string | null;
  /** Always `null` for state `"org"` — org upstreams are not read. */
  lastPushedAt: string | null;
  reachable: boolean;
}

/* -------------------------------------------------------------------------- */
/* Stable id unions                                                           */
/* -------------------------------------------------------------------------- */

export type TagId = "capsule" | "standby" | "quiet" | "ember" | "fork" | "archived";

export type TitleId =
  | "visitor"
  | "time-collector"
  | "ember-keeper"
  | "fork-voyager"
  | "idea-sower"
  | "light-traveler";

export type BoardId = "longest-sleep" | "embers" | "forks";

/* -------------------------------------------------------------------------- */
/* Payloads                                                                   */
/* -------------------------------------------------------------------------- */

export interface RepoSummary {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  /** `null` = unknown. **Never** `0` for unknown. */
  starCount: number | null;
  forkCount: number | null;
  pushedAt: string | null;
  createdAt: string | null;
  isFork: boolean | null;
  archived: boolean | null;
  /** `null` = could not read. `[]` = genuinely has no topics. */
  topics: string[] | null;
  /** `null` whenever `pushedAt` is `null`. */
  dormantDays: number | null;
  tags: TagId[];
  /** `null` for a non-fork — "not applicable", which is not the same as "unknown". */
  upstream: Upstream | null;
}

export interface TitleEvidence {
  /** The human-readable basis for the title, e.g. 「有 1 个仓库沉睡了超过 3 年」. */
  text: string;
}

export interface InspectPayload {
  account: {
    login: string;
    type: "User" | "Organization";
    avatarUrl: string | null;
  };
  /** The count of repos successfully read. `null` when unknown — never `0`-for-unknown. */
  repoCount: number | null;
  /** 带 topic 的公开仓库数 —— 灵龛里的灵魂数。`null` = 未知，绝不写成 0。 */
  enrolledCount: number | null;
  stats: {
    longestDormantDays: number | null;
    emberCount: number | null;
    forkCount: number | null;
    archivedCount: number | null;
  };
  title: {
    id: TitleId;
    name: string;
    evidence: TitleEvidence[];
  };
  representatives: {
    longestDormant: RepoSummary | null;
    brightestEmber: RepoSummary | null;
    travelledFork: RepoSummary | null;
  };
  repos: RepoSummary[];
  reposTruncated: boolean;
}

export interface BoardEntry {
  rank: number;
  repo: RepoSummary;
  /** The dormancy at which this entry was captured. `null` when unknown. */
  dormantDays: number | null;
}

/**
 * 收录状态的五态。
 *
 * `unconfirmed` 是**一等的答案**，不是 `no-topic` 的近似：它说的是「这次没能确认」，
 * 而 `no-topic` 说的是「确认没有主题」。只有后者能让用户去加主题。
 */
export type CollectionState =
  | "collected"
  | "pending"
  | "no-topic"
  | "not-eligible"
  | "unconfirmed";

export interface CollectionStatusPayload {
  fullName: string;
  state: CollectionState;
  /** 命中的那个配置主题；`null` = 没命中或无法判断。 */
  matchedTopic: string | null;
  /** 已收录时最近一次核实的时刻。与信封的 `readAt` 是两个时间，不合并。 */
  verifiedAt: string | null;
}

export type ClaimRejection = "not_owner" | "is_org" | "not_public" | "not_enrolled";

export interface ClaimPayload {
  fullName: string;
  /** 当前登录的账户是否认领了这个仓库。 */
  claimed: boolean;
  /** 仓库当前是否被隐藏。隐藏仍然算已收录。 */
  hidden: boolean;
  claimedAt: string | null;
  /** 当前账户能否操作它（认领了，且仓库仍然具备收录条件）。 */
  manageable: boolean;
}

/** 管理页的一条 —— 我认领过的仓库，以及它现在的样子。 */
export interface ManageClaim {
  fullName: string;
  claimedAt: string;
  hidden: boolean;
  /** 仓库仍然已收录，所以还能隐藏 / 恢复。 */
  manageable: boolean;
  /** 最近一次核实的时刻。与 `claimedAt` 是两件事。 */
  verifiedAt: string | null;
}

export interface ClaimsPayload {
  claims: ManageClaim[];
}

export type TakedownStatus = "received" | "actioned" | "rejected";

export interface TakedownPayload {
  ticket: string;
  status: TakedownStatus;
  createdAt: string;
  /** 承诺的处理时限（小时）。写进载荷，界面才能如实说「我们会在这个时间内看」。 */
  slaHours: number;
}

export interface TakedownStatusPayload {
  status: TakedownStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BoardPayload {
  id: BoardId;
  name: string;
  description: string;
  /** The criteria a repo had to meet to be enrolled on this board. */
  criteria: string;
  entries: BoardEntry[];
  /** `true` when a repo left the board because its topic was removed. */
  delistedCount: number | null;
}
