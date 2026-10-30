/**
 * OG 图上会出现的全部**固定**字符。
 *
 * 字面表放在同目录的 `og-vocabulary.json` 里，而不是写在这个文件里：它是**字体子集的
 * 输入**，而生成字体的是两个普通 Node 脚本（`scripts/build-og-font.mjs`、
 * `scripts/audit-og-font.mjs`）。它们要在**不经过 TypeScript 编译器**的前提下读到同一份
 * 清单 —— 直接 `import` 一个 `.ts` 文件要 Node 22.18+ 的类型剥离，而 `package.json`
 * 承诺的是 Node 20.19+。JSON 两边都能读，于是清单真正只有一份。
 *
 * **每种语言一份清单。** 三种语言用到的汉字并不相同（繁体的「讀取於」、
 * 日语的「取得日時」），所以字体子集也只有按语言切，才能既覆盖又不过大。
 * 英语用的是与简体相同的一份 `Noto Sans SC` 子集 —— 英语卡片上唯一的非
 * ASCII 字符是罗马数字与 ★，SC 子集里有。
 *
 * **它只有一个消费者，但有两个守卫：**
 *
 * 1. `src/worker/share/svg.test.ts` 把卡片模板实际渲染出来的每一个字符与这份清单比对 ——
 *    文案改了而清单没改，测试就会失败。
 * 2. `npm run audit:og-font` 解析字体文件的 cmap，确认清单里每个字符都有字形 ——
 *    字体没重新生成，审计就会失败。
 *
 * 用户数据只有 GitHub 用户名（按 GitHub 的规则只能是 ASCII）与域名，两者都在
 * 可打印 ASCII 里。**任意中文不进 OG 图**，所以字体只需要这一小撮字形。
 */

import { DEFAULT_LOCALE, type Locale } from "@/shared/i18n";
import vocabulary from "./og-vocabulary.json";

/** 可打印 ASCII（U+0020–U+007E）。用户名、域名、数字都在这里。 */
export const OG_ASCII_PRINTABLE: string = vocabulary.asciiPrintable;

/** 某语言的固定文案用到的非 ASCII 字符。 */
export function ogFixedGlyphs(locale: Locale): string {
  const locales = vocabulary.locales as Record<string, string>;
  return locales[locale] ?? locales[DEFAULT_LOCALE] ?? "";
}

/** 某语言的子集字体需要的全部字符。 */
export function ogVocabulary(locale: Locale): string {
  return OG_ASCII_PRINTABLE + ogFixedGlyphs(locale);
}
