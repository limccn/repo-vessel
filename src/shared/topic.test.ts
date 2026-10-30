import { describe, expect, it } from "vitest";
import {
  DEFAULT_REPO_TOPIC,
  DEFAULT_REPO_TOPICS,
  MAX_TOPIC_LENGTH,
  MAX_TOPICS,
  repoTopicsLabel,
  resolveRepoTopic,
  resolveRepoTopicList,
} from "./topic";

/**
 * 主题的解析规则。
 *
 * 规则只有这一份（SPA 与 Worker 共用），所以这里守住它 —— 解析之后的主题一定
 * 是可以直接交给 GitHub 搜索的：只含小写字母、数字与连字符，不以连字符开头
 * 或结尾，不超过 35 个字符。
 */
describe("resolveRepoTopic", () => {
  it("缺失 / 非字符串 / 空串 → 默认主题", () => {
    expect(resolveRepoTopic(undefined)).toBe(DEFAULT_REPO_TOPIC);
    expect(resolveRepoTopic(null)).toBe(DEFAULT_REPO_TOPIC);
    expect(resolveRepoTopic("")).toBe(DEFAULT_REPO_TOPIC);
  });

  it("去掉首尾空白", () => {
    expect(resolveRepoTopic("  repo-vessel  ")).toBe("repo-vessel");
    expect(resolveRepoTopic("\trepo-vessel\n")).toBe("repo-vessel");
  });

  it("转小写 —— GitHub 主题本身就是小写的", () => {
    expect(resolveRepoTopic("Repo-Vessel")).toBe("repo-vessel");
    expect(resolveRepoTopic("REPO-VESSEL")).toBe("repo-vessel");
  });

  it("非法字符换成连字符", () => {
    expect(resolveRepoTopic("repo vessel")).toBe("repo-vessel");
    expect(resolveRepoTopic("repo.vessel")).toBe("repo-vessel");
    expect(resolveRepoTopic("repo_vessel")).toBe("repo-vessel");
    expect(resolveRepoTopic("repo/vessel")).toBe("repo-vessel");
  });

  it("连续的连字符合并成一个，首尾的连字符去掉", () => {
    expect(resolveRepoTopic("a  b")).toBe("a-b");
    expect(resolveRepoTopic("--repo---vessel--")).toBe("repo-vessel");
  });

  it("截断到 35 个字符", () => {
    const long = "a".repeat(MAX_TOPIC_LENGTH + 10);
    expect(resolveRepoTopic(long)).toBe("a".repeat(MAX_TOPIC_LENGTH));
    expect(resolveRepoTopic(long)).toHaveLength(MAX_TOPIC_LENGTH);
  });

  it("被截断的主题不以连字符收尾", () => {
    const trailing = `${"a".repeat(MAX_TOPIC_LENGTH - 1)}-bc`;
    expect(resolveRepoTopic(trailing)).toBe("a".repeat(MAX_TOPIC_LENGTH - 1));
    expect(resolveRepoTopic(trailing)).not.toMatch(/-$/);
  });

  it("解析之后为空 → 默认主题", () => {
    expect(resolveRepoTopic("   ")).toBe(DEFAULT_REPO_TOPIC);
    expect(resolveRepoTopic("---")).toBe(DEFAULT_REPO_TOPIC);
    expect(resolveRepoTopic("!!!")).toBe(DEFAULT_REPO_TOPIC);
    expect(resolveRepoTopic("仓库")).toBe(DEFAULT_REPO_TOPIC);
  });

  it("默认主题本身是合法的", () => {
    expect(resolveRepoTopic(DEFAULT_REPO_TOPIC)).toBe(DEFAULT_REPO_TOPIC);
  });
});

describe("resolveRepoTopicList", () => {
  it("默认列表是两个等价主题，主主题在前", () => {
    expect(resolveRepoTopicList(undefined)).toEqual(["repo-vessel", "urn-of-repos"]);
    expect(resolveRepoTopicList(null)).toEqual([...DEFAULT_REPO_TOPICS]);
    expect(resolveRepoTopicList("")).toEqual([...DEFAULT_REPO_TOPICS]);
  });

  it("逗号 / 分号 / 空白都能分隔", () => {
    expect(resolveRepoTopicList("repo-vessel,urn-of-repos")).toEqual([
      "repo-vessel",
      "urn-of-repos",
    ]);
    expect(resolveRepoTopicList("repo-vessel，urn-of-repos")).toEqual([
      "repo-vessel",
      "urn-of-repos",
    ]);
    expect(resolveRepoTopicList("repo-vessel; urn-of-repos")).toEqual([
      "repo-vessel",
      "urn-of-repos",
    ]);
    expect(resolveRepoTopicList("repo-vessel urn-of-repos")).toEqual([
      "repo-vessel",
      "urn-of-repos",
    ]);
  });

  it("逐项归一化：大小写、非法字符、首尾连字符", () => {
    expect(resolveRepoTopicList("Repo.Vessel, --urn_of_repos--")).toEqual([
      "repo-vessel",
      "urn-of-repos",
    ]);
  });

  it("去重且保留第一次出现的顺序", () => {
    expect(resolveRepoTopicList("urn-of-repos,repo-vessel,urn-of-repos")).toEqual([
      "urn-of-repos",
      "repo-vessel",
    ]);
  });

  it("空项不会回落成默认主题", () => {
    expect(resolveRepoTopicList("a,,b")).toEqual(["a", "b"]);
    expect(resolveRepoTopicList(" , , ")).toEqual([...DEFAULT_REPO_TOPICS]);
  });

  it("上限是 MAX_TOPICS 项", () => {
    const many = Array.from({ length: MAX_TOPICS + 5 }, (_, i) => `topic-${i}`).join(",");
    expect(resolveRepoTopicList(many)).toHaveLength(MAX_TOPICS);
  });

  it("全部非法时回落到默认列表", () => {
    expect(resolveRepoTopicList("!!!,???,仓库")).toEqual([...DEFAULT_REPO_TOPICS]);
  });

  it("单主题配置仍然合法", () => {
    expect(resolveRepoTopicList("urn-of-repos")).toEqual(["urn-of-repos"]);
  });
});

describe("repoTopicsLabel", () => {
  it("用「或」连接，顺序不变", () => {
    expect(repoTopicsLabel(["repo-vessel", "urn-of-repos"])).toBe(
      "repo-vessel 或 urn-of-repos",
    );
  });

  it("单个主题没有连接词", () => {
    expect(repoTopicsLabel(["urn-of-repos"])).toBe("urn-of-repos");
  });
});
