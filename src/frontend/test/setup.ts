import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { LOCALE_STORAGE_KEY, setActiveLocale } from "@/shared/i18n";

/**
 * 测试环境的语言固定为简体中文。
 *
 * 站点的默认语言是英语，但既有的断言写的是**中文原句** —— 而中文原句同时
 * 就是词典的 msgid。把模块级当前语言钉在 `zh-Hans`，这些断言继续有意义；
 * 语言探测与切换有自己的专项测试（`src/shared/i18n.test.ts`、
 * `LanguagePreference.test.tsx`），它们在用例内部显式覆盖。
 */
setActiveLocale("zh-Hans");

Object.defineProperty(navigator, "language", { value: "zh-CN", configurable: true });
Object.defineProperty(navigator, "languages", {
  value: ["zh-CN"],
  configurable: true,
});

beforeEach(() => {
  setActiveLocale("zh-Hans");
  try {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    /* 隐私模式：没有存储可清。 */
  }
});
