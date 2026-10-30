// @vitest-environment node
/**
 * 语言模型与词典的守卫。
 *
 * 这里守三件事：
 *
 * 1. **检测顺序**：URL `?lang=` → 本地保存 → `navigator.languages` → 英语。
 *    顺序错了不会崩，只会让分享链接开出别人的语言 —— 所以要用测试钉住。
 * 2. **缺译的回落方向**：只有一条，回落到中文原句（msgid）。回落成英语是错的：
 *    中文读者看到英文，比看到一句还没翻的中文更糟。
 * 3. **词典的结构**：占位符必须对得上。`"有 {n} 个仓库…"` 的译文写成 `%d`，
 *    代码不会报错，界面上会永远缺一个数字。
 */

import { describe, expect, it } from "vitest";
import { EN, JA, ZH_HANT } from "./i18n-dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_PREFERENCES,
  detectLocale,
  isLocale,
  isLocalePreference,
  localeFromLanguage,
  negotiateLocale,
  normalizeLocale,
  preferenceForLocale,
  resolveLocalePreference,
  t,
} from "./i18n";

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "").sort();

describe("localeFromLanguage", () => {
  it.each([
    ["en", "en"],
    ["en-US", "en"],
    ["EN-gb", "en"],
    ["zh", "zh-Hans"],
    ["zh-CN", "zh-Hans"],
    ["zh-SG", "zh-Hans"],
    ["zh-TW", "zh-Hant"],
    ["zh-HK", "zh-Hant"],
    ["zh-MO", "zh-Hant"],
    ["zh-Hant", "zh-Hant"],
    ["zh-Hant-HK", "zh-Hant"],
    ["ja", "ja"],
    ["ja-JP", "ja"],
  ])("%s → %s", (tag, expected) => {
    expect(localeFromLanguage(tag)).toBe(expected);
  });

  it("不认识的语言返回 null，而不是猜一个", () => {
    for (const tag of ["de", "fr-FR", "ru", "", "  ", null, undefined]) {
      expect(localeFromLanguage(tag)).toBeNull();
    }
  });

  it("下划线与大小写都能读", () => {
    expect(localeFromLanguage("zh_TW")).toBe("zh-Hant");
    expect(localeFromLanguage("JA_jp")).toBe("ja");
  });
});

describe("negotiateLocale", () => {
  it("按 q 从高到低取第一个能识别的", () => {
    expect(negotiateLocale("de-DE;q=1, ja;q=0.8, en;q=0.5")).toBe("ja");
    expect(negotiateLocale("de;q=1, fr;q=0.9")).toBeNull();
  });

  it("没有 q 时按 1 处理，`*` 跳过", () => {
    expect(negotiateLocale("en-GB, ja;q=0.9")).toBe("en");
    expect(negotiateLocale("*")).toBeNull();
  });

  it("空头返回 null", () => {
    expect(negotiateLocale(null)).toBeNull();
    expect(negotiateLocale("")).toBeNull();
  });
});

describe("detectLocale", () => {
  it("URL 最优先", () => {
    expect(
      detectLocale({ search: "?lang=ja", stored: "zh-Hans", languages: ["en-US"] }),
    ).toBe("ja");
  });

  it("然后是本地保存的选择", () => {
    expect(detectLocale({ search: "", stored: "zh-Hant", languages: ["en-US"] })).toBe(
      "zh-Hant",
    );
  });

  it("然后才是浏览器语言列表，按浏览器给的顺序", () => {
    expect(detectLocale({ search: "", stored: null, languages: ["zh-CN", "en-US"] })).toBe(
      "zh-Hans",
    );
    expect(detectLocale({ search: "", stored: null, languages: ["fr-FR", "ja-JP"] })).toBe(
      "ja",
    );
  });

  it("三者都没有时是英语 —— 英语是默认语言", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(detectLocale({ search: "", stored: null, languages: [] })).toBe("en");
    expect(detectLocale({ search: "", stored: null, languages: ["de-DE"] })).toBe("en");
  });

  it("无效的 ?lang= 不算数，继续往下找", () => {
    expect(detectLocale({ search: "?lang=klingon", stored: "ja", languages: [] })).toBe("ja");
  });
});

describe("normalizeLocale / isLocale", () => {
  it("接受 Locale 本身，也接受语言标签", () => {
    expect(normalizeLocale("zh-Hans")).toBe("zh-Hans");
    expect(normalizeLocale("zh-TW")).toBe("zh-Hant");
    expect(normalizeLocale("nope")).toBeNull();
  });

  it("isLocale 只认四个值", () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    for (const value of ["en-US", "zh", "", null, 0]) expect(isLocale(value)).toBe(false);
  });

  it("英语排在最前 —— 默认语言就是语言列表的第一项", () => {
    expect(LOCALES[0]).toBe(DEFAULT_LOCALE);
  });
});

describe("语言偏好", () => {
  it("`zh` 的简／繁由浏览器地区决定，不由用户选", () => {
    expect(resolveLocalePreference("zh", ["zh-TW", "en-US"])).toBe("zh-Hant");
    expect(resolveLocalePreference("zh", ["zh-HK"])).toBe("zh-Hant");
    expect(resolveLocalePreference("zh", ["zh-CN"])).toBe("zh-Hans");
    expect(resolveLocalePreference("zh", ["zh-SG"])).toBe("zh-Hans");
    expect(resolveLocalePreference("zh", ["en-US"])).toBe("zh-Hans");
    expect(resolveLocalePreference("zh", null)).toBe("zh-Hans");
  });

  it("英语与日语原样返回，浏览器语言不参与", () => {
    expect(resolveLocalePreference("en", ["zh-TW"])).toBe("en");
    expect(resolveLocalePreference("ja", ["zh-TW"])).toBe("ja");
  });

  it("简繁都记作 `zh` —— 偏好是三种，不是四种", () => {
    expect(preferenceForLocale("zh-Hans")).toBe("zh");
    expect(preferenceForLocale("zh-Hant")).toBe("zh");
    expect(preferenceForLocale("en")).toBe("en");
    expect(preferenceForLocale("ja")).toBe("ja");
  });

  it("isLocalePreference 只认三个值", () => {
    for (const value of LOCALE_PREFERENCES) expect(isLocalePreference(value)).toBe(true);
    for (const value of ["zh-Hans", "zh-Hant", "fr", "", null, 0]) {
      expect(isLocalePreference(value)).toBe(false);
    }
  });
});

describe("t", () => {
  it("简体直接返回 msgid —— 中文原文就是键", () => {
    expect(t("码之灵龛", undefined, "zh-Hans")).toBe("码之灵龛");
  });

  it("有译文时用译文，并替换占位符", () => {
    const translated = t("再收 {n} 个仓库升到 {tier}。", { n: 3, tier: "Ⅲ 阶" }, "en");
    expect(translated).not.toContain("{");
    expect(translated).toContain("3");
  });

  it("缺译时回落到中文原句，不是空串", () => {
    expect(t("这句还没有翻译。", undefined, "ja")).toBe("这句还没有翻译。");
  });

  it("少传一个变量时占位符原样留着 —— 看得见的缺口好过悄悄消失的词", () => {
    expect(t("再收 {n} 个仓库。", {}, "en")).toContain("{n}");
  });
});

describe("词典结构", () => {
  const DICTIONARIES = [
    ["en", EN],
    ["zh-Hant", ZH_HANT],
    ["ja", JA],
  ] as const;

  it.each(DICTIONARIES)("%s 每一条都有内容，且占位符与 msgid 一致", (locale, dictionary) => {
    const problems: string[] = [];

    for (const [msgid, value] of Object.entries(dictionary)) {
      if (value.trim() === "") problems.push(`${msgid} → 空译文`);
      const expected = placeholders(msgid);
      const actual = placeholders(value);
      if (expected.join(",") !== actual.join(",")) {
        problems.push(`${msgid} → 占位符 {${expected.join(",")}} ≠ {${actual.join(",")}}`);
      }
    }

    expect({ locale, problems }).toEqual({ locale, problems: [] });
  });

  /* 英语里出现汉字，只有一种解释：这一条没翻。繁日两种语言与简体共用字形是正常的
     （「沉睡」「分享」在繁体里写法相同，「Star 数」在日语里也是这么写），所以这条
     规则只对英语成立 —— 它也是产品的默认语言，漏一条就是最显眼的那条。 */
  it("英语译文里不夹汉字", () => {
    const problems = Object.entries(EN)
      .filter(([, value]) => /[一-鿿]/u.test(value))
      .map(([msgid, value]) => `${msgid} → ${value}`);
    expect(problems).toEqual([]);
  });
});
