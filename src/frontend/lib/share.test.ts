import { describe, expect, it } from "vitest";
import { buildShareText, profileUrl, twitterIntentUrl } from "./share";

/**
 * 分享文案。
 *
 * 守住三件事：只陈述事实、不 @ 任何人、未知不进文案。
 * 再加一条：整句、等级名与链接里的 `lang` 都跟着传入的语言走。
 */
describe("buildShareText", () => {
  it("数量未知时返回 null —— 不把未知写成 0", () => {
    expect(
      buildShareText({ login: "alice", tier: null, enrolledCount: null, achievements: null }),
    ).toBeNull();
  });

  it("写清等级、数量与主题列表", () => {
    const text = buildShareText({
      login: "alice",
      tier: "ii",
      enrolledCount: 7,
      achievements: [],
    });
    expect(text).toContain("Ⅱ 阶");
    expect(text).toContain("7 个公开仓库");
    expect(text).toContain("repo-vessel 或 urn-of-repos");
    expect(text).toContain(profileUrl("alice"));
  });

  it("英语界面下整句换语言，链接仍带着同一种语言", () => {
    const text = buildShareText(
      { login: "alice", tier: "ii", enrolledCount: 7, achievements: [] },
      "en",
    );
    expect(text).toContain("I lit Tier Ⅱ in Repo Vessel: 7 public repositories");
    expect(text).toContain("repo-vessel or urn-of-repos");
    expect(text).toContain(profileUrl("alice", "en"));
  });

  it("已达成的徽章名写进文案", () => {
    const text = buildShareText({
      login: "alice",
      tier: "iv",
      enrolledCount: 25,
      achievements: ["urn-of-repos", "repo-vessel"],
    });
    expect(text).toContain("Urn of Repos");
    expect(text).toContain("Repo Vessel");
  });

  it("没有 @ —— 不在文案里点名任何人", () => {
    const text = buildShareText({
      login: "alice",
      tier: "i",
      enrolledCount: 1,
      achievements: [],
    });
    expect(text).not.toContain("@");
  });

  it("不含结论性词汇", () => {
    const text = buildShareText({
      login: "alice",
      tier: "iii",
      enrolledCount: 12,
      achievements: ["urn-of-repos"],
    });
    for (const word of ["失败", "最懒", "垃圾", "废物"]) {
      expect(text).not.toContain(word);
    }
  });
});

describe("profileUrl", () => {
  it("对用户名做 URL 编码", () => {
    expect(profileUrl("a b")).toContain("/u/a%20b");
  });

  it("带上 from=share，分享链接自己说明来路", () => {
    expect(profileUrl("alice")).toMatch(/\/u\/alice\?from=share&lang=zh-Hans$/);
  });

  it("带上 lang —— 打开分享链接的人看到同一种语言", () => {
    expect(profileUrl("alice", "ja")).toMatch(/[?&]lang=ja$/);
    expect(profileUrl("alice", "zh-Hant")).toContain("lang=zh-Hant");
  });
});

describe("twitterIntentUrl", () => {
  it("把整段文案编码进 intent", () => {
    const url = twitterIntentUrl("a b\nc");
    expect(url.startsWith("https://twitter.com/intent/tweet?text=")).toBe(true);
    expect(url).toContain("a%20b%0Ac");
  });
});
