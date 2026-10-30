// @vitest-environment node
/**
 * OG 卡与它的字形表。
 *
 * 这个文件守三件事：
 *
 * 1. **卡片上的每个字都有字形** —— 每一种语言各查一遍。子集字体只包含
 *    `og-vocabulary.json` 里该语言的字符；模板里多出现一个字而字形表没跟上，
 *    图上就会出现豆腐块。这里把六个称号 × 五档等级 × 四种语言全部渲染一遍，
 *    逐字比对 —— 文案改了而字体没重新生成，测试先失败。
 * 2. **未知写成 `? 未知`。** 不写 0，不写「未启封」。
 * 3. **语言真的换了。** 英语卡片上不该再出现中文，简体卡片也不该被翻译掉。
 */

import { describe, expect, it } from "vitest";
import { siteCopy } from "@/shared/copy";
import { LOCALES, type Locale } from "@/shared/i18n";
import { TIER_ORDER, TITLE_LABELS, titleLabel, type TitleId, type TierId } from "@/shared/ids";
import { OG_ASCII_PRINTABLE, ogVocabulary } from "./og-text";
import { buildOgCard, escapeXml, ogFontFamily, type OgCardFacts } from "./svg";

const TITLE_IDS = Object.keys(TITLE_LABELS) as TitleId[];

function unknownLabel(locale: Locale): string {
  return siteCopy(locale).shareCard.unknown;
}

function facts(overrides: Partial<OgCardFacts> = {}): OgCardFacts {
  return {
    login: "limccn",
    titleId: "time-collector",
    tier: "i",
    enrolledCount: 1,
    longestDormantDays: 4967,
    readAt: "2026-11-01T09:12:00.000Z",
    host: "repovessel.lmlh.net",
    ...overrides,
  };
}

/** 只取 `<text>` 元素里的可见文字 —— 标签与颜色不是字形问题。 */
function renderedText(svg: string): string {
  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1] ?? "").join("");
}

describe("buildOgCard", () => {
  it("画出用户名、称号、两个数与域名（简体）", () => {
    const svg = buildOgCard(facts(), "zh-Hans");
    const text = renderedText(svg);

    expect(text).toContain("@limccn");
    expect(text).toContain("时光收藏家");
    expect(text).toContain("4,967 天");
    expect(text).toContain("1 个");
    expect(text).toContain("repovessel.lmlh.net");
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  });

  it("英语卡片整张读得通，不夹中文", () => {
    const text = renderedText(buildOgCard(facts(), "en"));

    expect(text).toContain("Keeper of Hours");
    expect(text).toContain("4,967 days");
    expect(text).not.toMatch(/[一-鿿]/u);
  });

  it("繁体与日语各用自己的写法", () => {
    expect(renderedText(buildOgCard(facts(), "zh-Hant"))).toContain("時光收藏家");
    expect(renderedText(buildOgCard(facts(), "ja"))).toContain("時の蒐集家");
  });

  it("未知写成 ?, 不写 0，也不写未启封", () => {
    const text = renderedText(
      buildOgCard(facts({ tier: null, enrolledCount: null, longestDormantDays: null }), "en"),
    );

    expect(text).not.toMatch(/\d+\s*(个|個|days)/);
    expect(text).not.toContain("Unsealed");
    expect((text.match(new RegExp(escapeRegExp(unknownLabel("en")), "g")) ?? []).length).toBe(3);
  });

  it("读取时间读不到时写未知", () => {
    expect(renderedText(buildOgCard(facts({ readAt: null }), "zh-Hans"))).toContain("? 未知");
    expect(renderedText(buildOgCard(facts({ readAt: "nope" }), "zh-Hans"))).toContain("? 未知");
  });

  it("没有域名时不画那一角，不印假域名", () => {
    const svg = buildOgCard(facts({ host: null }));
    expect(svg).not.toContain("lmlh.net");
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("用户名里的尖括号与引号被转义", () => {
    const svg = buildOgCard(facts({ login: 'a<b&c"d' }));
    expect(svg).toContain("a&lt;b&amp;c&quot;d");
    expect(svg).not.toContain("<b&c");
  });

  it("卡上只有一个 @ —— 就是用户名本身", () => {
    expect((buildOgCard(facts()).match(/@/g) ?? []).length).toBe(1);
  });

  it("字形表的 ASCII 段正好是 U+0020–U+007E", () => {
    /* JSON 里的那串 ASCII 是手抄的，漏一个反斜杠或引号不会有测试在渲染时撞上。 */
    expect([...OG_ASCII_PRINTABLE].map((char) => char.codePointAt(0))).toEqual(
      Array.from({ length: 95 }, (_, index) => 32 + index),
    );
  });

  it("没读到称号时写未知，不编一个称号出来", () => {
    for (const locale of LOCALES) {
      const text = renderedText(buildOgCard(facts({ titleId: null }), locale));
      expect(text).toContain(unknownLabel(locale));
      for (const titleId of TITLE_IDS) {
        expect(text).not.toContain(titleLabel(titleId, locale).name);
      }
    }
  });

  it("每种语言都用自己的字体族", () => {
    expect(ogFontFamily("zh-Hans")).toBe("Noto Sans SC");
    expect(ogFontFamily("en")).toBe("Noto Sans SC");
    expect(ogFontFamily("zh-Hant")).toBe("Noto Sans TC");
    expect(ogFontFamily("ja")).toBe("Noto Sans JP");
    expect(buildOgCard(facts(), "ja")).toContain("Noto Sans JP");
  });

  it("每个称号 × 每档等级 × 每种语言的每一个字都有字形", () => {
    for (const locale of LOCALES) {
      const vocabulary = ogVocabulary(locale);
      const missing = new Set<string>();

      for (const titleId of [null, ...TITLE_IDS]) {
        for (const tier of [null, ...TIER_ORDER] as Array<TierId | null>) {
          const text = renderedText(buildOgCard(facts({ titleId, tier }), locale));
          for (const char of text) {
            if (!vocabulary.includes(char)) missing.add(char);
          }
        }
      }

      expect({ locale: locale as Locale, missing: [...missing] }).toEqual({
        locale,
        missing: [],
      });
    }
  });
});

describe("escapeXml", () => {
  it("把五个预定义实体都转义掉", () => {
    expect(escapeXml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&apos;");
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
