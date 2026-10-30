import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  achievementById,
  achievementRemaining,
  earnedAchievements,
} from "./achievements";
import { THRESHOLDS } from "./thresholds";

/**
 * 成就的判定。
 *
 * 最重要的一条：未知不是零。数量读不到时必须是 `null`，不能是 `[]`。
 */
describe("earnedAchievements", () => {
  it("未知数量返回 null，不是空数组", () => {
    expect(earnedAchievements(null)).toBeNull();
    expect(earnedAchievements(undefined)).toBeNull();
  });

  it("0 个仓库 → 没有徽章", () => {
    expect(earnedAchievements(0)).toEqual([]);
  });

  it("低于第一枚的门槛 → 没有徽章", () => {
    expect(earnedAchievements(THRESHOLDS.tierIIIMinRepos - 1)).toEqual([]);
  });

  it("达到第一枚门槛 → 只有 Urn of Repos", () => {
    expect(earnedAchievements(THRESHOLDS.tierIIIMinRepos)).toEqual(["urn-of-repos"]);
    expect(earnedAchievements(THRESHOLDS.tierIVMinRepos - 1)).toEqual(["urn-of-repos"]);
  });

  it("达到第二枚门槛 → 两枚都有，从低到高", () => {
    expect(earnedAchievements(THRESHOLDS.tierIVMinRepos)).toEqual([
      "urn-of-repos",
      "repo-vessel",
    ]);
  });

  it("两枚徽章的门槛与充能阶梯一致（10 / 25）", () => {
    expect(ACHIEVEMENTS.map((def) => def.minRepos)).toEqual([
      THRESHOLDS.tierIIIMinRepos,
      THRESHOLDS.tierIVMinRepos,
    ]);
    expect(ACHIEVEMENTS.map((def) => def.minRepos)).toEqual([10, 25]);
  });
});

describe("achievementRemaining", () => {
  it("未知数量返回 null", () => {
    expect(achievementRemaining(null, achievementById("urn-of-repos"))).toBeNull();
  });

  it("已达成返回 0", () => {
    expect(achievementRemaining(10, achievementById("urn-of-repos"))).toBe(0);
  });

  it("未达成返回差额", () => {
    expect(achievementRemaining(7, achievementById("urn-of-repos"))).toBe(3);
    expect(achievementRemaining(0, achievementById("repo-vessel"))).toBe(25);
  });
});

describe("ACHIEVEMENTS", () => {
  it("徽章图与下载名齐全", () => {
    for (const def of ACHIEVEMENTS) {
      expect(def.badgeSrc).toMatch(/^\/badges\/.+\.png$/);
      expect(def.downloadName).toMatch(/\.png$/);
      expect(def.badgeAlt.length).toBeGreaterThan(0);
    }
  });

  it("文案里没有评价性的词", () => {
    const words = ["失败", "最懒", "垃圾", "废物"];
    for (const def of ACHIEVEMENTS) {
      for (const word of words) {
        expect(def.requirement).not.toContain(word);
      }
    }
  });
});
