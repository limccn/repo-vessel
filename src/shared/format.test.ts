import { describe, expect, it } from "vitest";
import {
  formatAgo,
  formatDuration,
  formatLanguage,
  formatNumber,
  formatRelativeTime,
} from "@/shared/format";

describe("formatDuration", () => {
  it("读不到时返回 null，绝不返回 0", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(Number.NaN)).toBeNull();
  });

  it("带单位并加千分位", () => {
    expect(formatDuration(0)).toBe("0 天");
    expect(formatDuration(1024)).toBe("1,024 天");
  });
});

describe("formatNumber", () => {
  it("读不到时返回 null", () => {
    expect(formatNumber(null)).toBeNull();
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");

  it("读不到时返回 null", () => {
    expect(formatRelativeTime(null, "zh-Hans", now)).toBeNull();
    expect(formatRelativeTime("不是时间", "zh-Hans", now)).toBeNull();
  });

  it("用中文相对时间", () => {
    expect(formatRelativeTime("2026-10-30T11:59:30Z", "zh-Hans", now)).toBe("刚刚");
    expect(formatRelativeTime("2026-10-30T11:45:00Z", "zh-Hans", now)).toBe("15 分钟前");
    expect(formatRelativeTime("2026-10-30T09:00:00Z", "zh-Hans", now)).toBe("3 小时前");
    expect(formatRelativeTime("2026-10-28T12:00:00Z", "zh-Hans", now)).toBe("2 天前");
  });
});

describe("formatAgo", () => {
  it("读不到时返回 null", () => {
    expect(formatAgo(null)).toBeNull();
  });
});

describe("formatLanguage", () => {
  it("空字符串等同于没有语言", () => {
    expect(formatLanguage("  ")).toBeNull();
    expect(formatLanguage(null)).toBeNull();
    expect(formatLanguage("Rust")).toBe("Rust");
  });
});
