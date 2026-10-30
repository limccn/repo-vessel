/**
 * 假数据 —— 形状与真实 API 信封完全一致。
 *
 * `{ data, completeness, missingPages, readAt }`。组件层不知道这些是假的：
 * 换成真实 Worker 时，只需要改掉调用方的一个 import。
 *
 * 这份数据必须覆盖产品里的**每一种未知态**。一份全是好数据的数据集什么都
 * 证明不了。
 */

import type {
  BoardEntry,
  BoardId,
  BoardPayload,
  Envelope,
  InspectPayload,
  RepoSummary,
  TagId,
} from "@/shared/contract";
import { THRESHOLDS } from "@/shared/thresholds";
import { REPO_TOPIC_LABEL } from "@/frontend/lib/env";

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** 假数据的形态开关。只有 mock 认它，真实 API 不认。 */
export interface DemoOptions {
  /** 信封是否只读到了一部分。 */
  completeness?: "complete" | "partial";
  /** 读取时间回退多少小时。`40` 就是「两天前读到的」。 */
  ageHours?: number;
}

/**
 * 原型的状态演示开关。
 *
 * `?demo=partial` → 不完整信封；`?demo=stale` → 读取时间回到 40 小时前，
 * 于是「这是 X 天前的数据」那条常驻提示条会真的出现。
 *
 * 产品里的每一种状态都必须能被看见 —— 一份只有好数据的原型什么都证明不了。
 */
export function demoOptions(search: string): DemoOptions {
  const value = new URLSearchParams(search).get("demo");
  if (value === "partial") return { completeness: "partial" };
  if (value === "stale") return { ageHours: 40 };
  return {};
}

/**
 * 信封的读取时间。`ageHours` 把它往回拨，用来演示陈旧态。
 * 真实接口给的是它自己读到的那一刻。
 */
function readAtFrom(options: DemoOptions): string {
  const hours = options.ageHours ?? 0;
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

interface RepoSeed {
  owner: string;
  name: string;
  description?: string | null;
  language?: string | null;
  stars?: number | null;
  forks?: number | null;
  days?: number | null;
  tags?: TagId[];
  archived?: boolean;
  isFork?: boolean;
  upstream?: RepoSummary["upstream"];
}

function repo(seed: RepoSeed): RepoSummary {
  const dormantDays = seed.days === undefined ? null : seed.days;
  const pushedAt = dormantDays === null ? null : daysAgo(dormantDays);
  return {
    owner: seed.owner,
    name: seed.name,
    fullName: `${seed.owner}/${seed.name}`,
    description: seed.description ?? null,
    language: seed.language === undefined ? "TypeScript" : seed.language,
    /* 没写就是没读到 —— 不写成 0。假数据也得守「未知 ≠ 0」这条不变式。 */
    starCount: seed.stars === undefined ? null : seed.stars,
    forkCount: seed.forks === undefined ? null : seed.forks,
    pushedAt,
    createdAt: daysAgo((dormantDays ?? 30) + 400),
    isFork: seed.isFork ?? false,
    archived: seed.archived ?? false,
    topics: null,
    dormantDays,
    tags: seed.tags ?? [],
    upstream: seed.upstream ?? null,
  };
}

const ALICE_REPOS: RepoSummary[] = [
  repo({
    owner: "alice",
    name: "time-capsule-lab",
    description: "一个把实验结果封存起来的小工具，三年没动过。",
    stars: 412,
    forks: 37,
    days: 1204,
    tags: ["capsule"],
  }),
  repo({
    owner: "alice",
    name: "solo-project",
    description: null,
    language: null,
    stars: 45,
    forks: 6,
    days: 1180,
    tags: ["capsule", "ember"],
  }),
  repo({
    owner: "alice",
    name: "deep-standby-service",
    description: "内部服务。上一次改动是一年多以前。",
    stars: 38,
    forks: 4,
    days: 520,
    tags: ["standby", "ember"],
  }),
  repo({
    owner: "alice",
    name: "ember-glow",
    description: "还在被人收藏的小组件库。",
    stars: 96,
    forks: 11,
    days: 380,
    tags: ["standby", "ember"],
  }),
  repo({
    owner: "alice",
    name: "fork-of-glimmer",
    description: "从 glimmer/glimmer 出发的分支，后来走去了别的方向。",
    stars: 5,
    forks: 1,
    days: 640,
    tags: ["standby", "fork"],
    isFork: true,
    upstream: {
      state: "personal",
      owner: "glimmer",
      repo: "glimmer",
      lastPushedAt: daysAgo(900),
      reachable: true,
    },
  }),
  repo({
    owner: "alice",
    name: "lost-upstream",
    description: "出发之后，上游就找不到了。",
    stars: null,
    forks: null,
    days: 700,
    tags: ["standby", "fork"],
    isFork: true,
    upstream: {
      state: "unreachable",
      owner: "unknown-archive",
      repo: "archive",
      lastPushedAt: null,
      reachable: false,
    },
  }),
  repo({
    owner: "alice",
    name: "archived-notes",
    description: "作者在 GitHub 上归档了这个仓库。",
    stars: 3,
    forks: 0,
    days: 800,
    tags: ["standby", "archived"],
    archived: true,
  }),
  repo({
    owner: "alice",
    name: "quiet-tooling",
    description: "半年没动过，但还有人用。",
    stars: 12,
    forks: 2,
    days: 240,
    tags: ["quiet"],
  }),
  repo({
    owner: "alice",
    name: "nightly-bot",
    description: "每晚跑一次的机器人。",
    stars: 8,
    forks: 1,
    days: 300,
    tags: ["quiet"],
  }),
  repo({
    owner: "alice",
    name: "tiny-parser",
    description: null,
    language: "Rust",
    stars: 2,
    forks: 0,
    days: 150,
  }),
  repo({
    owner: "alice",
    name: "active-cli",
    description: "这周还在改。",
    stars: 7,
    forks: 1,
    days: 9,
  }),
  repo({
    owner: "alice",
    name: "unknown-push",
    description: "这个仓库没有可读的推送时间。",
    stars: 21,
    forks: 3,
    days: null,
  }),
];

/**
 * 每个假账号的「带主题的公开仓库数」—— 灵龛里的灵魂数。
 *
 * 这份数据让充能阶梯在原型里看得见：Ⅲ / Ⅱ / Ⅰ 三档各出现一次，数字都不
 * 超过 `repoCount`（12），所以「入龛的仓库比公开仓库还多」这种不合理的
 * 状态不会出现。
 */
const ENROLLED_BY_LOGIN: Record<string, number | null> = {
  alice: 7,
  nadia: 11,
  kenji: 5,
  rune: 1,
};

/**
 * 表里没有的账号一律「未知」。
 *
 * 假数据也得覆盖未知态 —— 一份全是好数据的数据集什么都证明不了。
 * 于是随便输一个用户名就能看到「? 未知」那一档。
 */
function enrolledCountFor(login: string): number | null {
  return ENROLLED_BY_LOGIN[login] ?? null;
}

export function mockInspect(
  username: string,
  options: DemoOptions = {},
): Envelope<InspectPayload> {
  const completeness = options.completeness ?? "complete";
  const repos = ALICE_REPOS;

  const payload: InspectPayload = {
    account: {
      login: username,
      type: "User",
      avatarUrl: null,
    },
    repoCount: repos.length,
    enrolledCount: enrolledCountFor(username),
    stats: {
      longestDormantDays: 1204,
      emberCount: 3,
      forkCount: 2,
      archivedCount: 1,
    },
    title: {
      id: "time-collector",
      name: "时光收藏家",
      evidence: [{ text: "有 2 个仓库沉睡了超过 3 年。" }],
    },
    representatives: {
      longestDormant: repos[0] ?? null,
      brightestEmber: repos[3] ?? null,
      travelledFork: repos[4] ?? null,
    },
    repos,
    reposTruncated: false,
  };

  return {
    data: payload,
    completeness,
    missingPages: completeness === "partial" ? [2] : [],
    readAt: readAtFrom(options),
  };
}

const BOARD_SEEDS: RepoSeed[] = [
  { owner: "nadia", name: "atlas-of-small-things", stars: 87, days: 2100, tags: ["capsule"] },
  { owner: "kenji", name: "quiet-compiler", stars: 34, days: 1680, tags: ["capsule"] },
  { owner: "rune", name: "paper-terminal", stars: 128, days: 1430, tags: ["capsule", "ember"], isFork: true },
  { owner: "mira", name: "slow-migrations", stars: 19, days: 1210, tags: ["capsule"] },
  { owner: "tobias", name: "ninety-nine-lists", stars: 61, days: 1180, tags: ["capsule"] },
  { owner: "ines", name: "warm-compiler", stars: 8, days: 980, tags: ["standby"] },
  { owner: "oskar", name: "brass-and-glass", stars: 44, days: 760, tags: ["standby", "ember"], isFork: true },
  { owner: "yara", name: "lantern-notes", stars: 5, days: 610, tags: ["standby"] },
  { owner: "piotr", name: "half-finished-oracle", stars: 27, days: 420, tags: ["standby"], isFork: true },
  { owner: "lin", name: "small-rain", stars: 3, days: 240, tags: ["quiet"] },
];

const BOARD_REPOS = BOARD_SEEDS.map(repo);

/**
 * 每个榜单按它自己公开的收录条件筛选与排序。
 *
 * 榜单页面上写着「收录条件：沉睡 ≥ 181 天」，那表里就不该出现 240 天以外的
 * 例外 —— 条件是公开的规则，列出来的名次必须守得住它。
 */
function boardRepos(boardId: BoardId): RepoSummary[] {
  switch (boardId) {
    case "longest-sleep":
      return BOARD_REPOS.filter(
        (r) => r.dormantDays !== null && r.dormantDays >= THRESHOLDS.boardMinDormantDays,
      ).sort((a, b) => (b.dormantDays ?? 0) - (a.dormantDays ?? 0));
    case "embers":
      return BOARD_REPOS.filter(
        (r) =>
          r.dormantDays !== null &&
          r.dormantDays >= THRESHOLDS.emberMinDays &&
          r.starCount !== null &&
          r.starCount >= THRESHOLDS.emberMinStars,
      ).sort((a, b) => (b.starCount ?? 0) - (a.starCount ?? 0));
    case "forks":
      return BOARD_REPOS.filter((r) => r.isFork).sort(
        (a, b) => (b.dormantDays ?? 0) - (a.dormantDays ?? 0),
      );
  }
}

function boardEntries(boardId: BoardId): BoardEntry[] {
  return boardRepos(boardId).map((r, index) => ({
    rank: index + 1,
    repo: r,
    dormantDays: r.dormantDays,
  }));
}

export function mockBoard(boardId: BoardId, options: DemoOptions = {}): Envelope<BoardPayload> {
  const meta: Record<BoardId, { name: string; description: string; criteria: string }> = {
    "longest-sleep": {
      name: "最长沉睡榜",
      description: "它们没有走远，只是很久没有推送。",
      criteria: `收录条件：仓库带有 ${REPO_TOPIC_LABEL} 主题，且沉睡 ≥ 181 天。`,
    },
    embers: {
      name: "余烬未熄榜",
      description: "有些仓库安静了，星星还亮着。",
      criteria: `收录条件：仓库带有 ${REPO_TOPIC_LABEL} 主题，且沉睡 ≥ 365 天、Star ≥ 32。`,
    },
    forks: {
      name: "Fork 漂流榜",
      description: "从别处出发，在这里继续走了一段。",
      criteria: `收录条件：仓库带有 ${REPO_TOPIC_LABEL} 主题，且是一个 Fork。`,
    },
  };

  const info = meta[boardId];
  const payload: BoardPayload = {
    id: boardId,
    name: info.name,
    description: info.description,
    criteria: info.criteria,
    entries: boardEntries(boardId),
    delistedCount: 0,
  };

  return {
    data: payload,
    completeness: options.completeness ?? "complete",
    missingPages: options.completeness === "partial" ? [2] : [],
    readAt: readAtFrom(options),
  };
}

/** M2 首页用的一组「围观中」的账号，用来撑起落地页的灵龛阵列。 */
export function mockShelfEnvelopes(): Array<Envelope<InspectPayload>> {
  return ["nadia", "kenji", "rune"].map((login) => mockInspect(login));
}
