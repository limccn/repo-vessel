/**
 * 派生层的边界测试。
 *
 * 这一层最容易出的错不是算错，而是**把不知道算成了 0**。所以每条用例都盯着
 * 一个「未知」分支：`pushed_at` 缺失、`topics` 缺失、截断之后的计数。
 */

import { describe, expect, it } from "vitest";
import type { RepoSummary } from "@/shared/contract";
import type { GitHubRepo } from "@/worker/github/users";
import { buildCounts } from "@/worker/derive/stats";
import { dormantDaysOf, tagsOf, toRepoSummary, upstreamOf } from "@/worker/derive/summary";
import { deriveTitle } from "@/worker/derive/title";

const READ_AT = "2024-01-01T00:00:00.000Z";

function daysBefore(days: number): string {
  return new Date(Date.parse(READ_AT) - days * 86_400_000).toISOString();
}

function rawRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: "vessel",
    full_name: "limccn/vessel",
    owner: { login: "limccn", type: "User" },
    description: "一件被好好收着的东西",
    language: "TypeScript",
    stargazers_count: 5,
    forks_count: 1,
    pushed_at: daysBefore(10),
    created_at: daysBefore(900),
    fork: false,
    archived: false,
    private: false,
    topics: [],
    ...overrides,
  };
}

describe("dormantDaysOf", () => {
  it("按整天计算，舍去不足一天的部分", () => {
    expect(dormantDaysOf("2023-12-31T12:00:00.000Z", READ_AT)).toBe(0);
    expect(dormantDaysOf(daysBefore(3), READ_AT)).toBe(3);
  });

  it("没有推送时间时是未知，不是 0", () => {
    expect(dormantDaysOf(null, READ_AT)).toBeNull();
    expect(dormantDaysOf(undefined, READ_AT)).toBeNull();
  });

  it("时间戳坏掉时是未知", () => {
    expect(dormantDaysOf("不是日期", READ_AT)).toBeNull();
  });
});

describe("tagsOf", () => {
  it("按沉睡档位给标签，并按固定顺序排列", () => {
    expect(tagsOf({ dormantDays: 1095, starCount: 0, isFork: false, archived: false })).toEqual([
      "capsule",
    ]);
    expect(tagsOf({ dormantDays: 365, starCount: 0, isFork: false, archived: false })).toEqual([
      "standby",
    ]);
    expect(tagsOf({ dormantDays: 181, starCount: 0, isFork: false, archived: false })).toEqual([
      "quiet",
    ]);
    expect(tagsOf({ dormantDays: 180, starCount: 0, isFork: false, archived: false })).toEqual([]);
  });

  it("余烬要求天数与 Star 都读到", () => {
    const base = { dormantDays: 400, isFork: false, archived: false };
    expect(tagsOf({ ...base, starCount: 32 })).toEqual(["standby", "ember"]);
    expect(tagsOf({ ...base, starCount: 31 })).toEqual(["standby"]);
    // Star 未知时不能给「有余烬」——那是替上游编了个数字。
    expect(tagsOf({ ...base, starCount: null })).toEqual(["standby"]);
  });

  it("沉睡天数未知时不给任何沉睡标签", () => {
    expect(tagsOf({ dormantDays: null, starCount: 100, isFork: true, archived: true })).toEqual([
      "fork",
      "archived",
    ]);
  });
});

describe("upstreamOf", () => {
  it("非 Fork 是 null（不适用 ≠ 未知）", () => {
    expect(upstreamOf(rawRepo({ fork: false }))).toBeNull();
  });

  it("拿不到 parent 时是 unresolved", () => {
    expect(upstreamOf(rawRepo({ fork: true }))?.state).toBe("unresolved");
  });

  it("组织上游被记名，但不读它的推送时间", () => {
    const upstream = upstreamOf(
      rawRepo({
        fork: true,
        parent: {
          name: "kit",
          full_name: "cloudflare/kit",
          owner: { login: "cloudflare", type: "Organization" },
          pushed_at: "2020-01-01T00:00:00Z",
        },
      }),
    );
    expect(upstream).toMatchObject({ state: "org", owner: "cloudflare", repo: "kit" });
    expect(upstream?.lastPushedAt).toBeNull();
  });

  it("个人上游带推送时间", () => {
    const upstream = upstreamOf(
      rawRepo({
        fork: true,
        parent: {
          name: "kit",
          full_name: "someone/kit",
          owner: { login: "someone", type: "User" },
          pushed_at: "2021-06-01T00:00:00Z",
        },
      }),
    );
    expect(upstream).toMatchObject({
      state: "personal",
      lastPushedAt: "2021-06-01T00:00:00Z",
    });
  });
});

describe("toRepoSummary", () => {
  it("topics 缺失是 null，空数组才是 []", () => {
    expect(toRepoSummary(rawRepo({ topics: undefined }), READ_AT).topics).toBeNull();
    expect(toRepoSummary(rawRepo({ topics: [] }), READ_AT).topics).toEqual([]);
  });

  it("数字字段缺失时不给 0", () => {
    const summary = toRepoSummary(
      rawRepo({ stargazers_count: undefined, forks_count: null }),
      READ_AT,
    );
    expect(summary.starCount).toBeNull();
    expect(summary.forkCount).toBeNull();
  });
});

function summary(overrides: Partial<RepoSummary> = {}): RepoSummary {
  return {
    owner: "limccn",
    name: "vessel",
    fullName: "limccn/vessel",
    description: null,
    language: null,
    starCount: 0,
    forkCount: 0,
    pushedAt: daysBefore(10),
    createdAt: null,
    isFork: false,
    archived: false,
    topics: [],
    dormantDays: 10,
    tags: [],
    upstream: null,
    ...overrides,
  };
}

describe("buildCounts", () => {
  const topics = ["repo-vessel", "urn-of-repos"];

  it("完整读取时才给计数", () => {
    const counts = buildCounts({
      repos: [
        summary({ topics: ["repo-vessel"] }),
        summary({ fullName: "a/b", topics: ["other"] }),
      ],
      topics,
      complete: true,
    });
    expect(counts.repoCount).toBe(2);
    expect(counts.enrolledCount).toBe(1);
  });

  it("截断时只保留最沉睡天数，其余一律未知", () => {
    const counts = buildCounts({
      repos: [summary({ dormantDays: 4000, tags: ["capsule"], topics: ["repo-vessel"] })],
      topics,
      complete: false,
    });
    expect(counts.stats.longestDormantDays).toBe(4000);
    expect(counts.repoCount).toBeNull();
    expect(counts.enrolledCount).toBeNull();
    expect(counts.stats.emberCount).toBeNull();
    expect(counts.stats.forkCount).toBeNull();
    expect(counts.stats.archivedCount).toBeNull();
  });

  it("有仓库的 topics 读不到时，收录数是未知而不是少算", () => {
    const counts = buildCounts({
      repos: [summary({ topics: ["repo-vessel"] }), summary({ fullName: "a/b", topics: null })],
      topics,
      complete: true,
    });
    expect(counts.enrolledCount).toBeNull();
  });
});

describe("deriveTitle", () => {
  it("少于 3 个仓库是初访者", () => {
    expect(deriveTitle([summary(), summary({ fullName: "a/b" })], 2, "zh-Hans").id).toBe(
      "visitor",
    );
  });

  it("有三年以上的仓库是时光收藏家，证据只写数字", () => {
    const title = deriveTitle(
      [summary({ tags: ["capsule"], dormantDays: 1200 })],
      1,
      "zh-Hans",
    );
    expect(title.id).toBe("visitor"); // 1 个仓库仍然先是初访者
    const two = deriveTitle(
      [summary({ tags: ["capsule"] }), summary({ fullName: "a/b" })],
      2,
      "zh-Hans",
    );
    expect(two.id).toBe("visitor");

    const bigger = deriveTitle(
      [
        summary({ tags: ["capsule"] }),
        summary({ fullName: "a/b" }),
        summary({ fullName: "c/d" }),
      ],
      3,
      "zh-Hans",
    );
    expect(bigger.id).toBe("time-collector");
    expect(bigger.evidence[0]?.text).toContain("1 个");
  });

  it("有余烬时是余烬守护者", () => {
    const repos = [
      summary({ tags: ["ember"] }),
      summary({ fullName: "a/b" }),
      summary({ fullName: "c/d" }),
    ];
    expect(deriveTitle(repos, 3, "zh-Hans").id).toBe("ember-keeper");
  });

  it("Fork 过半且至少 3 个时是 Fork 漂流者", () => {
    const repos = [
      summary({ isFork: true }),
      summary({ fullName: "a/b", isFork: true }),
      summary({ fullName: "c/d", isFork: true }),
      summary({ fullName: "e/f", isFork: false }),
    ];
    expect(deriveTitle(repos, 4, "zh-Hans").id).toBe("fork-voyager");
  });

  it("原创过半且至少 8 个时是想法播种者", () => {
    const repos = Array.from({ length: 10 }, (_, index) =>
      summary({ fullName: `u/r${index}`, isFork: false }),
    );
    expect(deriveTitle(repos, 10, "zh-Hans").id).toBe("idea-sower");
  });

  it("数量未知时给默认称号，且不编证据", () => {
    const title = deriveTitle([], null, "zh-Hans");
    expect(title.id).toBe("visitor");
    expect(title.evidence).toEqual([]);
  });

  it("称号名与证据句随语言变，数字与判定不变", () => {
    const repos = [
      summary({ tags: ["capsule"] }),
      summary({ fullName: "a/b" }),
      summary({ fullName: "c/d" }),
    ];

    const en = deriveTitle(repos, 3, "en");
    const zhHant = deriveTitle(repos, 3, "zh-Hant");
    const ja = deriveTitle(repos, 3, "ja");

    expect(en.id).toBe("time-collector");
    expect(en.name).toBe("Keeper of Hours");
    expect(en.evidence[0]?.text).toBe("Last pushed three years ago or earlier: 1.");
    expect(zhHant.name).toBe("時光收藏家");
    expect(zhHant.evidence[0]?.text).toBe("有 1 個儲存庫的最後一次推送在三年前或更早。");
    expect(ja.name).toBe("時の蒐集家");
    expect(ja.evidence[0]?.text).toBe(
      "三年前か、それより前に最後のプッシュを終えたリポジトリ：1 個。",
    );
  });

  it("比例在每种语言里都由代码算出来", () => {
    const repos = [
      summary({ isFork: true }),
      summary({ fullName: "a/b", isFork: true }),
      summary({ fullName: "c/d", isFork: true }),
      summary({ fullName: "e/f", isFork: false }),
    ];
    const en = deriveTitle(repos, 4, "en");
    expect(en.name).toBe("Fork Drifter");
    expect(en.evidence[0]?.text).toBe("Forks: 3 (75% of public repositories).");
  });
});
