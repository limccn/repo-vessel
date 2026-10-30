import { describe, expect, it, vi } from "vitest";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";
import { incrementMetric, recordMetric, utcDay } from "./metrics-store";

describe("utcDay", () => {
  it("按 UTC 切日，不按本地时区", () => {
    expect(utcDay(new Date("2026-11-01T23:59:59.999Z"))).toBe("2026-11-01");
    expect(utcDay(new Date("2026-11-02T00:00:00.000Z"))).toBe("2026-11-02");
  });
});

describe("incrementMetric", () => {
  it("同一天同一事件同一维度只累加一行", async () => {
    const fake = createFakeCollectionDb();
    const at = new Date("2026-11-01T12:00:00.000Z");

    await incrementMetric(fake.db, "inspect_read", "complete", 1, at);
    await incrementMetric(fake.db, "inspect_read", "complete", 1, at);
    await incrementMetric(fake.db, "inspect_read", "partial", 1, at);

    expect(fake.metrics.get("2026-11-01|inspect_read|complete")).toBe(2);
    expect(fake.metrics.get("2026-11-01|inspect_read|partial")).toBe(1);
    expect([...fake.metrics.keys()]).toHaveLength(2);
  });

  it("按 UTC 日分行", async () => {
    const fake = createFakeCollectionDb();

    await incrementMetric(fake.db, "takedown_submit", "received", 1, new Date("2026-11-01T23:00:00Z"));
    await incrementMetric(fake.db, "takedown_submit", "received", 1, new Date("2026-11-02T01:00:00Z"));

    expect(fake.metrics.get("2026-11-01|takedown_submit|received")).toBe(1);
    expect(fake.metrics.get("2026-11-02|takedown_submit|received")).toBe(1);
  });

  it("Cron 可以一次加多笔", async () => {
    const fake = createFakeCollectionDb();

    await incrementMetric(fake.db, "collect_run", "discovered", 412);

    const [key, value] = [...fake.metrics.entries()][0] ?? [];
    expect(key?.endsWith("|collect_run|discovered")).toBe(true);
    expect(value).toBe(412);
  });

  it("维度不在受控词表里就抛错", async () => {
    const fake = createFakeCollectionDb();

    await expect(
      incrementMetric(fake.db, "page_view", "route=/u/alice,src=direct"),
    ).rejects.toThrow(/invalid dim/);
    await expect(
      incrementMetric(fake.db, "topic_copy", "topic=alice/secret"),
    ).rejects.toThrow(/invalid dim/);
  });

  it("数量必须是非负整数", async () => {
    const fake = createFakeCollectionDb();

    await expect(incrementMetric(fake.db, "collect_run", "delisted", -1)).rejects.toThrow(
      /invalid amount/,
    );
    await expect(incrementMetric(fake.db, "collect_run", "delisted", 1.5)).rejects.toThrow(
      /invalid amount/,
    );
  });
});

describe("recordMetric", () => {
  it("没有 DB 时是空操作", async () => {
    await expect(recordMetric({}, "takedown_submit", "received")).resolves.toBeUndefined();
  });

  it("D1 失败不抛 —— 指标是旁路", async () => {
    const fake = createFakeCollectionDb({ fail: true });

    await expect(
      recordMetric({ DB: fake.db }, "takedown_submit", "received"),
    ).resolves.toBeUndefined();
  });

  it("有 ctx 时交给 waitUntil", async () => {
    const fake = createFakeCollectionDb();
    const waited: Promise<unknown>[] = [];

    await recordMetric({ DB: fake.db }, "inspect_read", "complete", 1, {
      waitUntil(promise) {
        waited.push(promise);
      },
    });

    expect(waited).toHaveLength(1);
    await Promise.all(waited);
    expect([...fake.metrics.keys()].some((key) => key.endsWith("|inspect_read|complete"))).toBe(
      true,
    );
  });
});

describe("警告只打一次", () => {
  it("连续失败不会每个请求刷一条日志", async () => {
    // 模块级的 `warned` 会在同一文件里跨测试保留，先拿一份全新的模块。
    vi.resetModules();
    const fresh = await import("./metrics-store");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fake = createFakeCollectionDb({ fail: true });

    await fresh.recordMetric({ DB: fake.db }, "takedown_submit", "received");
    await fresh.recordMetric({ DB: fake.db }, "takedown_submit", "received");

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
