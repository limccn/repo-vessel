/**
 * 语言的唯一来源。
 *
 * 首帧语言按 `detectLocale()` 解析：URL `?lang=` → 本地保存的选择 →
 * `navigator.languages` → 英语。切换语言时同时更新三处：React 状态、
 * `src/shared/i18n.ts` 的模块级当前语言（不走 React 的 `api/client.ts` 也读得到）、
 * 以及 `<html lang>`。
 *
 * 同步 `?lang=` 进 URL 是**分享**的需要：分享出去的链接带着分享者的语言，
 * 打开的人看到同一张卡片。用 `replace` 而不是 `push` —— 换语言不该在浏览器
 * 历史里留下一步，否则「后退」会退回上一种语言而不是上一个页面。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { siteCopy } from "@/shared/copy";
import {
  LOCALE_STORAGE_KEY,
  LOCALE_TAGS,
  detectLocale,
  getActiveLocale,
  resolveLocalePreference,
  setActiveLocale,
  t as translate,
  type Locale,
  type Vars,
} from "@/shared/i18n";
import { fetchSession } from "@/frontend/lib/auth";
export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** 查表 + 插值。缺译回落到中文原句。 */
  t: (msgid: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * 没有 Provider 时的兜底。
 *
 * 单元测试与隔离渲染不该被迫包一层 Provider；它们读模块级当前语言
 * （测试的 `setup.ts` 把它固定在 `zh-Hans`）。`setLocale` 是空操作 ——
 * 没有 Provider 就没有状态可改，静默无操作比抛错更符合「组件仍能渲染」。
 */
function fallbackValue(): I18nValue {
  const locale = getActiveLocale();
  return {
    locale,
    setLocale: () => {},
    t: (msgid, vars) => translate(msgid, vars, locale),
  };
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());
  const location = useLocation();
  const navigate = useNavigate();

  /* 这一页用户已经亲手按过语言。登录偏好的请求可能还没回来，回来时不能
     把用户刚选的语言顶回去 —— 后到的异步结果不配覆盖一个更晚的点击。 */
  const userChose = useRef(false);

  /* 只改语言，不碰 URL。登录态带来的偏好用它 —— 那次切换不是用户在当前页
     按的按钮，不该往地址栏里写 `?lang=`。 */
  const applyLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setActiveLocale(next);
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      userChose.current = true;
      applyLocale(next);
      const params = new URLSearchParams(location.search);
      if (params.get("lang") !== next) {
        params.set("lang", next);
        const search = params.toString();
        navigate(`${location.pathname}${search ? `?${search}` : ""}${location.hash}`, {
          replace: true,
        });
      }
    },
    [applyLocale, location.pathname, location.search, location.hash, navigate],
  );

  /**
   * 登录用户的语言偏好。
   *
   * 偏好存在签名会话 Cookie 里，前端读不到，所以要问一次 Worker。三个前提：
   *
   * - **URL 上有 `?lang=` 就不问** —— 那是这一页的显式声明（分享链接），
   *   比账号偏好更具体。
   * - **用户在本页已经按过语言就不应用** —— 点击比请求结果新。
   * - 只改语言，**不写 `?lang=`** —— 否则每个页面都会被改写一次地址。
   * - 结果会写进 `localStorage`（下面的同步 effect 做的），所以同一台浏览器
   *   下次打开时首帧就是对的；跨设备时才需要这一次异步纠正。
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("lang")) return;
    const controller = new AbortController();
    void fetchSession(controller.signal).then((session) => {
      if (!session?.lang || userChose.current) return;
      applyLocale(resolveLocalePreference(session.lang, navigator.languages ?? []));
    });
    return () => controller.abort();
  }, [applyLocale]);

  useEffect(() => {
    setActiveLocale(locale);
    document.documentElement.lang = LOCALE_TAGS[locale];
    document.title = siteCopy(locale).meta.title;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* 同上。 */
    }
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (msgid, vars) => translate(msgid, vars, locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  return value ?? fallbackValue();
}

/** 当前语言 —— 只关心语言、不需要 `t` 的组件用它。 */
export function useLocale(): Locale {
  return useI18n().locale;
}
