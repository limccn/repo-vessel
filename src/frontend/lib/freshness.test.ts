import { describe, expect, it } from "vitest";
import { THRESHOLDS } from "@/shared/thresholds";
import { ageHours, isStale, staleAgeLabel } from "@/frontend/lib/freshness";

const NOW = Date.parse("2026-10-30T12:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

describe("ageHours", () => {
  it("算出数据年龄", () => {
    expect(ageHours(hoursAgo(3), NOW)).toBeCloseTo(3, 5);
    expect(ageHours(hoursAgo(0), NOW)).toBeCloseTo(0, 5);
  });

  it("时间戳读不到时返回 null —— 未知不等于刚刚", () => {
    expect(ageHours(null, NOW)).toBeNull();
    expect(ageHours("不是时间", NOW)).toBeNull();
  });
});

describe("isStale", () => {
  it("24 小时内是新鲜的，超过就是陈旧", () => {
    expect(isStale(hoursAgo(1), NOW)).toBe(false);
    expect(isStale(hoursAgo(THRESHOLDS.staleAfterHours), NOW)).toBe(false);
    expect(isStale(hoursAgo(THRESHOLDS.staleAfterHours + 1), NOW)).toBe(true);
  });

  it("阈值就是公开的那个数", () => {
    expect(THRESHOLDS.staleAfterHours).toBe(24);
  });

  it("读不到时间戳时不算陈旧 —— 那不是「旧」，那是读不出来", () => {
    expect(isStale(null, NOW)).toBe(false);
  });

  it("时间戳在将来不算陈旧", () => {
    expect(isStale(hoursAgo(-5), NOW)).toBe(false);
  });
});

describe("staleAgeLabel", () => {
  it("新鲜时不给标签", () => {
    expect(staleAgeLabel(hoursAgo(2), NOW)).toBeNull();
    expect(staleAgeLabel(null, NOW)).toBeNull();
  });

  it("陈旧时给出天数", () => {
    expect(staleAgeLabel(hoursAgo(40), NOW)).toBe("2 天");
    expect(staleAgeLabel(hoursAgo(24 * 3), NOW)).toBe("3 天");
  });

  it("不满一天也向上取整，不让它听起来比实际更新", () => {
    expect(staleAgeLabel(hoursAgo(25), NOW)).toBe("2 天");
  });

  it("单位跟着语言走 —— 与 formatDuration 是同一份规则", () => {
    expect(staleAgeLabel(hoursAgo(40), NOW, "en")).toBe("2 days");
    expect(staleAgeLabel(hoursAgo(24 * 3), NOW, "ja")).toBe("3 日");
    expect(staleAgeLabel(hoursAgo(24 * 3), NOW, "zh-Hant")).toBe("3 天");
  });
});
