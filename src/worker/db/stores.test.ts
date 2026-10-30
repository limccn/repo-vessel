import { describe, expect, it } from "vitest";
import type { CollectedRepoRow } from "@/worker/db/schema";
import { normalizeFullName } from "@/worker/db/schema";
import {
  delistedNoTopicSince,
  listForBoard,
  listToVerify,
  loadCursor,
  markDelisted,
  readCollected,
  recordVerifyFailure,
  saveCursor,
  setHidden,
  upsertVerified,
} from "@/worker/db/collect-store";
import { deleteClaim, listClaimsByLogin, readClaim, writeClaim } from "@/worker/db/claim-store";
import {
  countRecentTakedowns,
  insertTakedown,
  readTakedown,
} from "@/worker/db/takedown-store";
import { createFakeCollectionDb } from "@/worker/test/fakeCollectionDb";

const AT = "2026-11-01T00:00:00.000Z";

function row(overrides: Partial<CollectedRepoRow> = {}): CollectedRepoRow {
  return {
    full_name: "owner/repo",
    owner: "owner",
    name: "repo",
    owner_type: "User",
    is_private: 0,
    is_fork: 0,
    archived: 0,
    star_count: 3,
    fork_count: 0,
    pushed_at: "2024-01-01T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    description: null,
    language: "TypeScript",
    topics_json: '["repo-vessel"]',
    enrolled_topic: "repo-vessel",
    verify_state: "verified",
    verify_failures: 0,
    verified_at: AT,
    first_seen_at: AT,
    last_seen_at: AT,
    delisted_reason: null,
    delisted_at: null,
    hidden_by: null,
    ...overrides,
  };
}

function input(fullName = "owner/repo") {
  const [owner, name] = fullName.split("/") as [string, string];
  return {
    fullName,
    owner,
    name,
    ownerType: "User",
    isPrivate: false,
    isFork: false,
    archived: false,
    starCount: 3,
    forkCount: 0,
    pushedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    description: null,
    language: "TypeScript",
    topics: ["repo-vessel"],
    enrolledTopic: "repo-vessel",
    seenAt: AT,
  };
}

describe("normalizeFullName", () => {
  it("小写并保留 owner/name 形态", () => {
    expect(normalizeFullName(" Limccn/Repo-Vessel ")).toBe("limccn/repo-vessel");
  });

  it("拒绝没有斜杠、多斜杠与非法字符的输入", () => {
    expect(normalizeFullName("limccn")).toBeNull();
    expect(normalizeFullName("a/b/c")).toBeNull();
    expect(normalizeFullName("a b/c")).toBeNull();
    expect(normalizeFullName("-bad/repo")).toBeNull();
  });
});

describe("upsertVerified", () => {
  it("重扫不复活已隐藏的仓库", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ hidden_by: "owner" })] });

    await upsertVerified(fake.db, input());

    expect(fake.repos.get("owner/repo")?.hidden_by).toBe("owner");
  });

  it("不清掉初遇时间，但刷新核实时间", async () => {
    const fake = createFakeCollectionDb({
      repos: [row({ first_seen_at: "2020-01-01T00:00:00.000Z", verified_at: null })],
    });

    await upsertVerified(fake.db, input());

    const stored = fake.repos.get("owner/repo");
    expect(stored?.first_seen_at).toBe("2020-01-01T00:00:00.000Z");
    expect(stored?.verified_at).toBe(AT);
  });

  it("一次成功核实把失败计数清零，并清掉下架记录", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({
          verify_state: "unverified",
          verify_failures: 4,
          delisted_reason: "no-topic",
          delisted_at: AT,
        }),
      ],
    });

    await upsertVerified(fake.db, input());

    const stored = fake.repos.get("owner/repo");
    expect(stored?.verify_state).toBe("verified");
    expect(stored?.verify_failures).toBe(0);
    expect(stored?.delisted_reason).toBeNull();
  });
});

describe("复核失败", () => {
  it("一次失败不改变状态，只累加", async () => {
    const fake = createFakeCollectionDb({ repos: [row()] });

    await recordVerifyFailure(fake.db, "owner/repo", AT, 6);

    expect(fake.repos.get("owner/repo")?.verify_state).toBe("verified");
    expect(fake.repos.get("owner/repo")?.verify_failures).toBe(1);
  });

  it("连续失败到阈值后离开榜单", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ verify_failures: 5 })] });

    await recordVerifyFailure(fake.db, "owner/repo", AT, 6);

    expect(fake.repos.get("owner/repo")?.verify_state).toBe("unverified");
  });
});

describe("listForBoard", () => {
  const cutoff = "2024-06-01T00:00:00.000Z";

  it("只读已核实且未隐藏的行", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/verified", owner: "a" }),
        row({ full_name: "b/hidden", owner: "b", hidden_by: "owner" }),
        row({ full_name: "c/unverified", owner: "c", verify_state: "unverified" }),
        row({ full_name: "d/delisted", owner: "d", verify_state: "delisted" }),
      ],
    });

    const rows = await listForBoard(fake.db, "longest-sleep", cutoff, 32, 50);

    expect(rows.map((entry) => entry.full_name)).toEqual(["a/verified"]);
  });

  it("尊重沉睡截止时间：太新的仓库不在这张榜上", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/old", owner: "a", pushed_at: "2023-01-01T00:00:00.000Z" }),
        row({ full_name: "b/new", owner: "b", pushed_at: "2024-07-01T00:00:00.000Z" }),
      ],
    });

    const rows = await listForBoard(fake.db, "longest-sleep", cutoff, 32, 50);

    expect(rows.map((entry) => entry.full_name)).toEqual(["a/old"]);
  });

  it("余烬榜要求 Star 达标，并按 Star 降序", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/few", owner: "a", star_count: 5 }),
        row({ full_name: "b/many", owner: "b", star_count: 300 }),
        row({ full_name: "c/some", owner: "c", star_count: 60 }),
      ],
    });

    const rows = await listForBoard(fake.db, "embers", cutoff, 32, 50);

    expect(rows.map((entry) => entry.full_name)).toEqual(["b/many", "c/some"]);
  });

  it("Fork 榜只收 Fork", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/fork", owner: "a", is_fork: 1 }),
        row({ full_name: "b/original", owner: "b", is_fork: 0 }),
      ],
    });

    const rows = await listForBoard(fake.db, "forks", cutoff, 32, 50);

    expect(rows.map((entry) => entry.full_name)).toEqual(["a/fork"]);
  });
});

describe("listToVerify", () => {
  it("最久没核实（含从未核实）的排在前面", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/recent", owner: "a", verified_at: "2026-10-31T00:00:00.000Z" }),
        row({ full_name: "b/old", owner: "b", verified_at: "2025-01-01T00:00:00.000Z" }),
        row({ full_name: "c/never", owner: "c", verified_at: null }),
        row({ full_name: "d/gone", owner: "d", verify_state: "delisted" }),
      ],
    });

    const rows = await listToVerify(fake.db, 10);

    expect(rows.map((entry) => entry.full_name)).toEqual(["c/never", "b/old", "a/recent"]);
  });
});

describe("下架与隐藏", () => {
  it("下架保留 hidden_by，两件事不互相覆盖", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ hidden_by: "takedown" })] });

    await markDelisted(fake.db, "owner/repo", "no-topic", AT);

    const stored = fake.repos.get("owner/repo");
    expect(stored?.verify_state).toBe("delisted");
    expect(stored?.delisted_reason).toBe("no-topic");
    expect(stored?.hidden_by).toBe("takedown");
  });

  it("setHidden(null) 恢复展示", async () => {
    const fake = createFakeCollectionDb({ repos: [row({ hidden_by: "owner" })] });

    await setHidden(fake.db, "owner/repo", null, AT);

    expect((await readCollected(fake.db, "owner/repo"))?.hidden_by).toBeNull();
  });

  it("只统计窗口内因主题下架的数量", async () => {
    const fake = createFakeCollectionDb({
      repos: [
        row({ full_name: "a/one", owner: "a", verify_state: "delisted", delisted_reason: "no-topic", delisted_at: "2026-10-20T00:00:00.000Z" }),
        row({ full_name: "b/two", owner: "b", verify_state: "delisted", delisted_reason: "no-topic", delisted_at: "2020-01-01T00:00:00.000Z" }),
        row({ full_name: "c/three", owner: "c", verify_state: "delisted", delisted_reason: "private", delisted_at: "2026-10-20T00:00:00.000Z" }),
      ],
    });

    expect(await delistedNoTopicSince(fake.db, "2026-10-01T00:00:00.000Z")).toBe(1);
    expect(await delistedNoTopicSince(undefined, "2026-10-01T00:00:00.000Z")).toBeNull();
  });
});

describe("collection_state 游标", () => {
  it("写得进也读得出", async () => {
    const fake = createFakeCollectionDb();
    const cursor = {
      topicIndex: 1,
      page: 3,
      cycle: 4,
      startedAt: AT,
      lastRunAt: AT,
      lastSummary: "发现 12 条，复核 40 条",
    };

    await saveCursor(fake.db, cursor);

    expect(await loadCursor(fake.db)).toEqual(cursor);
  });

  it("没有 DB 时返回 null，不抛", async () => {
    expect(await loadCursor(undefined)).toBeNull();
  });
});

describe("repo_claim", () => {
  it("写、读、按登录名列、删", async () => {
    const fake = createFakeCollectionDb();

    await writeClaim(fake.db, "owner/repo", "Owner", AT);
    await writeClaim(fake.db, "owner/other", "owner", AT);

    expect((await readClaim(fake.db, "owner/repo"))?.login).toBe("owner");
    expect((await listClaimsByLogin(fake.db, "OWNER")).map((row) => row.full_name)).toEqual([
      "owner/repo",
      "owner/other",
    ]);

    await deleteClaim(fake.db, "owner/repo");
    expect(await readClaim(fake.db, "owner/repo")).toBeNull();
  });
});

describe("takedown_request", () => {
  it("写入后能凭工单号读到，且只读到状态与时间", async () => {
    const fake = createFakeCollectionDb();

    await insertTakedown(fake.db, {
      ticket: "ticket-1",
      fullName: "owner/repo",
      reason: "这是我的仓库",
      ipHash: "hash-1",
      at: AT,
    });

    const stored = await readTakedown(fake.db, "ticket-1");
    expect(stored?.status).toBe("received");
    expect(stored?.created_at).toBe(AT);
  });

  it("按来源与窗口计数", async () => {
    const fake = createFakeCollectionDb();

    await insertTakedown(fake.db, { ticket: "t1", fullName: "a/x", reason: null, ipHash: "h", at: AT });
    await insertTakedown(fake.db, { ticket: "t2", fullName: "a/y", reason: null, ipHash: "h", at: AT });
    await insertTakedown(fake.db, { ticket: "t3", fullName: "a/z", reason: null, ipHash: "other", at: AT });

    expect(await countRecentTakedowns(fake.db, "h", "2026-10-31T23:00:00.000Z")).toBe(2);
  });
});
