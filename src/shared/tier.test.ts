import { describe, expect, it } from "vitest";
import { THRESHOLDS } from "./thresholds";
import {
  nextTier,
  reposToNextTier,
  tierBand,
  tierChargeRatio,
  tierFor,
} from "./tier";

/**
 * 灵龛充能等级。
 *
 * 两条不变式在这里守住：
 * 1. **未知 ≠ 0。** 未知永远是未知，绝不退化成「未启封」。
 * 2. **条永远不空。** 任何 Ⅰ 阶及以上的档位都有一条不为空的条，且它量的是
 *    当前档的顶 —— 档底是 1/档宽，档顶是满格。
 */
describe("tierFor", () => {
  it("每一个边界都落在正确的档位", () => {
    expect(tierFor(0)).toBe("unsealed");
    expect(tierFor(1)).toBe("i");
    expect(tierFor(4)).toBe("i");
    expect(tierFor(5)).toBe("ii");
    expect(tierFor(9)).toBe("ii");
    expect(tierFor(10)).toBe("iii");
    expect(tierFor(24)).toBe("iii");
    expect(tierFor(25)).toBe("iv");
    expect(tierFor(100)).toBe("iv");
  });

  it("阈值就是发布出去的那几个数字", () => {
    expect(THRESHOLDS.tierIMinRepos).toBe(1);
    expect(THRESHOLDS.tierIIMinRepos).toBe(5);
    expect(THRESHOLDS.tierIIIMinRepos).toBe(10);
    expect(THRESHOLDS.tierIVMinRepos).toBe(25);
  });

  it("未知永远是未知 —— 绝不退化成「未启封」", () => {
    expect(tierFor(null)).toBeNull();
    expect(tierFor(undefined)).toBeNull();
  });
});

describe("tierBand", () => {
  it("每一档的区间", () => {
    expect(tierBand("unsealed")).toEqual({ floor: 0, nextFloor: 1 });
    expect(tierBand("i")).toEqual({ floor: 1, nextFloor: 5 });
    expect(tierBand("ii")).toEqual({ floor: 5, nextFloor: 10 });
    expect(tierBand("iii")).toEqual({ floor: 10, nextFloor: 25 });
    expect(tierBand("iv")).toEqual({ floor: 25, nextFloor: null });
  });
});

describe("tierChargeRatio", () => {
  it("未启封没有条 —— 没什么可填的", () => {
    expect(tierChargeRatio(0)).toBeNull();
  });

  it("最高阶没有下一档 —— 读作「充能完毕」，不是一条满格", () => {
    expect(tierChargeRatio(25)).toBeNull();
    expect(tierChargeRatio(100)).toBeNull();
  });

  it("未知没有条", () => {
    expect(tierChargeRatio(null)).toBeNull();
    expect(tierChargeRatio(undefined)).toBeNull();
  });

  it("任何 Ⅰ 阶及以上的档位，条都不为空", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 9, 10, 11, 24]) {
      const ratio = tierChargeRatio(count);
      expect(ratio).not.toBeNull();
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });

  it("条量的是当前档的顶 —— 档底是 1/档宽，档顶是满格", () => {
    expect(tierChargeRatio(1)).toBeCloseTo(1 / 4);
    expect(tierChargeRatio(4)).toBeCloseTo(1);
    expect(tierChargeRatio(5)).toBeCloseTo(1 / 5);
    expect(tierChargeRatio(9)).toBeCloseTo(1);
    expect(tierChargeRatio(10)).toBeCloseTo(1 / 15);
    expect(tierChargeRatio(24)).toBeCloseTo(1);
  });
});

describe("nextTier", () => {
  it("每一档的下一档", () => {
    expect(nextTier("unsealed")).toBe("i");
    expect(nextTier("i")).toBe("ii");
    expect(nextTier("ii")).toBe("iii");
    expect(nextTier("iii")).toBe("iv");
  });

  it("最高阶没有下一阶", () => {
    expect(nextTier("iv")).toBeNull();
  });

  it("下一档的下界正好是「还差几个」的答案", () => {
    for (const count of [0, 1, 4, 5, 9, 10, 24]) {
      const tier = tierFor(count)!;
      const next = nextTier(tier)!;
      expect(tierBand(next).floor - count).toBe(reposToNextTier(count));
    }
  });
});

describe("reposToNextTier", () => {
  it("还差几个仓库到下一阶", () => {
    expect(reposToNextTier(0)).toBe(1);
    expect(reposToNextTier(1)).toBe(4);
    expect(reposToNextTier(4)).toBe(1);
    expect(reposToNextTier(5)).toBe(5);
    expect(reposToNextTier(24)).toBe(1);
  });

  it("最高阶没有下一阶", () => {
    expect(reposToNextTier(25)).toBeNull();
    expect(reposToNextTier(100)).toBeNull();
  });

  it("未知没有下一阶", () => {
    expect(reposToNextTier(null)).toBeNull();
    expect(reposToNextTier(undefined)).toBeNull();
  });
});
