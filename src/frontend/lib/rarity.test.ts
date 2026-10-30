import { describe, expect, it } from "vitest";
import { THRESHOLDS } from "@/shared/thresholds";
import {
  rarityMeterRatio,
  rarityMeterVars,
  rarityOf,
} from "@/frontend/lib/rarity";

describe("rarityOf", () => {
  it("把沉睡天数映射到稀有度等级", () => {
    expect(rarityOf(0)).toBe("common");
    expect(rarityOf(180)).toBe("common");
    expect(rarityOf(181)).toBe("rare");
    expect(rarityOf(364)).toBe("rare");
    expect(rarityOf(365)).toBe("epic");
    expect(rarityOf(1094)).toBe("epic");
    expect(rarityOf(1095)).toBe("legendary");
    expect(rarityOf(3000)).toBe("legendary");
  });

  it("等级边界与休眠标签的边界完全一致", () => {
    expect(THRESHOLDS.rarityRareMinDays).toBe(THRESHOLDS.quietMinDays);
    expect(THRESHOLDS.rarityEpicMinDays).toBe(THRESHOLDS.standbyMinDays);
    expect(THRESHOLDS.rarityLegendaryMinDays).toBe(THRESHOLDS.capsuleMinDays);
  });

  it("读不到沉睡天数时不给等级 —— 未知不能退化成「普通」", () => {
    expect(rarityOf(null)).toBeNull();
    expect(rarityOf(Number.NaN)).toBeNull();
  });
});

describe("rarityMeterRatio", () => {
  it("永远朝「稀有」那一端填充，读不到就空着", () => {
    expect(rarityMeterRatio(0)).toBe(0);
    expect(rarityMeterRatio(1095)).toBe(1);
    expect(rarityMeterRatio(9999)).toBe(1);
    expect(rarityMeterRatio(null)).toBeNull();
  });

  it("传出的比例永远在 0 与 1 之间", () => {
    expect(rarityMeterRatio(-5)).toBe(0);
  });
});

describe("rarityMeterVars", () => {
  it("传说是金色，计量条的两端都不是错误色", () => {
    const legendary = rarityMeterVars("legendary");
    expect(legendary.from).toContain("gold");
    expect(legendary.to).not.toContain("alert");
  });
});
