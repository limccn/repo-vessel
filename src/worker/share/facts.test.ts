// @vitest-environment node
/**
 * 信封 → 卡片事实。
 *
 * 守的是**没有数据时不许有事实**：`null` 信封里除了请求带来的用户名，
 * 一个字段都不能凭空出现。
 */

import { describe, expect, it } from "vitest";
import type { Envelope, InspectPayload } from "@/shared/contract";
import { factsFor } from "./facts";

function envelope(overrides: Partial<InspectPayload> = {}): Envelope<InspectPayload> {
  const data: InspectPayload = {
    account: { login: "LimcCN", type: "User", avatarUrl: null },
    repoCount: 3,
    enrolledCount: 1,
    stats: {
      longestDormantDays: 4967,
      emberCount: 0,
      forkCount: 1,
      archivedCount: 0,
    },
    title: { id: "time-collector", name: "时光收藏家", evidence: [] },
    representatives: { longestDormant: null, brightestEmber: null, travelledFork: null },
    repos: [],
    reposTruncated: false,
    ...overrides,
  };
  return { data, completeness: "complete", missingPages: [], readAt: "2026-11-01T09:12:00.000Z" };
}

describe("factsFor", () => {
  it("读到数据时逐字段搬运，用户名用 GitHub 的规范写法", () => {
    expect(factsFor(envelope(), "limccn", "repovessel.lmlh.net")).toEqual({
      login: "LimcCN",
      titleId: "time-collector",
      tier: "i",
      enrolledCount: 1,
      longestDormantDays: 4967,
      readAt: "2026-11-01T09:12:00.000Z",
      host: "repovessel.lmlh.net",
    });
  });

  it("读失败时除了用户名什么都不给", () => {
    const facts = factsFor(null, "limccn", "repovessel.lmlh.net");

    expect(facts).toEqual({
      login: "limccn",
      titleId: null,
      tier: null,
      enrolledCount: null,
      longestDormantDays: null,
      readAt: null,
      host: "repovessel.lmlh.net",
    });
  });

  it("未知的计数不会被降级成 0 或未启封", () => {
    const facts = factsFor(
      envelope({ enrolledCount: null, stats: { longestDormantDays: null, emberCount: null, forkCount: null, archivedCount: null } }),
      "limccn",
      null,
    );

    expect(facts.enrolledCount).toBeNull();
    expect(facts.tier).toBeNull();
    expect(facts.longestDormantDays).toBeNull();
    expect(facts.host).toBeNull();
  });

  it("0 个是事实，不是未知", () => {
    const facts = factsFor(envelope({ enrolledCount: 0 }), "limccn", null);

    expect(facts.enrolledCount).toBe(0);
    expect(facts.tier).toBe("unsealed");
  });
});
