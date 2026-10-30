// @vitest-environment node
/**
 * 分享卡的模型层。
 *
 * 这里只测**写什么字**，不测怎么画 —— 画布本身在 jsdom 里没有实现，而决定
 * 「未知写成 ? 还是 0」的正是这一层。语言显式传 `zh-Hans`：测试环境的默认
 * 语言就是简体，但一个显式参数让断言不依赖模块状态。
 */

import { describe, expect, it } from "vitest";
import { buildShareCardModel, type ShareCardInput } from "./shareCard";

const LOCALE = "zh-Hans" as const;

function input(overrides: Partial<ShareCardInput> = {}): ShareCardInput {
  return {
    login: "limccn",
    titleName: "时光收藏家",
    tier: "i",
    enrolledCount: 1,
    longestDormantDays: 4967,
    readAt: "2026-11-01T09:12:00.000Z",
    ...overrides,
  };
}

describe("buildShareCardModel", () => {
  it("把有值的字段照原样写出来", () => {
    const model = buildShareCardModel(input(), LOCALE, "repovessel.lmlh.net");

    expect(model.siteName).toBe("码之灵龛 · Repo Vessel");
    expect(model.login).toBe("@limccn");
    expect(model.titleName).toBe("时光收藏家");
    expect(model.host).toBe("repovessel.lmlh.net");
    expect(model.rows).toEqual([
      { label: "灵龛充能等级", value: "Ⅰ 阶 ★", unknown: false },
      { label: "最长沉睡", value: "4,967 天", unknown: false },
      { label: "带主题仓库", value: "1 个", unknown: false },
    ]);
  });

  it("英语卡片用英语标签、无「个」的计数，站名不重复拉丁名", () => {
    const model = buildShareCardModel(input(), "en");

    expect(model.siteName).toBe("Repo Vessel");
    expect(model.rows).toEqual([
      { label: "Vessel Charge", value: "Tier Ⅰ ★", unknown: false },
      { label: "Longest slumber", value: "4,967 days", unknown: false },
      { label: "Enrolled", value: "1", unknown: false },
    ]);
    expect(model.readAtValue).toBe("Read at 2026-11-01");
  });

  it("数量未知时不写 0，等级也不写未启封", () => {
    const model = buildShareCardModel(input({ tier: null, enrolledCount: null }), LOCALE);

    const [tier, dormant, enrolled] = model.rows;
    expect(tier?.value).toBe("? 未知");
    expect(enrolled?.value).toBe("? 未知");
    /* 未知行要被打上标记：图上的「? 未知」用未知专用的灰，不用数据强调色。 */
    expect(tier?.unknown).toBe(true);
    expect(enrolled?.unknown).toBe(true);
    expect(dormant?.unknown).toBe(false);
    expect(model.rows.map((row) => row.value).join(" ")).not.toContain("0 个");
    expect(model.rows.map((row) => row.value).join(" ")).not.toContain("未启封");
  });

  it("未知标签同样按语言写 —— 英语卡片不出现中文「未知」", () => {
    const model = buildShareCardModel(
      input({ tier: null, enrolledCount: null }),
      "en",
    );
    expect(model.rows[0]?.value).toBe("? Unknown");
    expect(model.rows[2]?.value).toBe("? Unknown");
  });

  it("沉睡天数未知时只影响那一行", () => {
    const model = buildShareCardModel(input({ longestDormantDays: null }), LOCALE);

    expect(model.rows[1]?.value).toBe("? 未知");
    expect(model.rows[0]?.value).toBe("Ⅰ 阶 ★");
    expect(model.rows[2]?.value).toBe("1 个");
  });

  it("读取时间读不到时写未知，不写今天", () => {
    expect(buildShareCardModel(input({ readAt: "not-a-date" }), LOCALE).readAtValue).toBe(
      "? 未知",
    );
  });

  it("读取时间写成日期，不带时分", () => {
    const model = buildShareCardModel(input(), LOCALE);
    expect(model.readAtValue).toMatch(/^读取于 \d{4}-\d{2}-\d{2}$/);
  });

  it("没有主机名时 host 是空串，不是 undefined 或假域名", () => {
    expect(buildShareCardModel(input(), LOCALE).host).toBe("");
    expect(buildShareCardModel(input(), LOCALE, null).host).toBe("");
  });

  it("星标跟着档位走，未启封没有星", () => {
    const labels = buildShareCardModel(input({ tier: "unsealed", enrolledCount: 0 }), LOCALE)
      .rows[0]?.value;
    expect(labels).toBe("未启封");
  });

  it("卡上不出现别人的用户名，也不出现 @ 提及语法之外的用户名", () => {
    const model = buildShareCardModel(input(), LOCALE);
    const flat = JSON.stringify(model);
    expect(flat).not.toContain("@limccn."); // 只有自己那一个 @
    expect((flat.match(/@/g) ?? []).length).toBe(1);
  });
});
