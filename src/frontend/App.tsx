import { useEffect, useRef } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { SiteFooter } from "@/frontend/components/chrome/SiteFooter";
import { SiteHeader } from "@/frontend/components/chrome/SiteHeader";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { trackPageView } from "@/frontend/lib/analytics";
import { BoardRoute } from "@/frontend/routes/BoardRoute";
import { HowRoute } from "@/frontend/routes/HowRoute";
import { InspectRoute, ReposRoute } from "@/frontend/routes/InspectRoute";
import { LandingRoute } from "@/frontend/routes/LandingRoute";
import { ManageRoute } from "@/frontend/routes/ManageRoute";
import { TakedownRoute } from "@/frontend/routes/TakedownRoute";

/**
 * 路由切换后的焦点管理（交互规范 §8.3）。
 *
 * 换页时把焦点移到新页面的 `<h1>`（`tabindex="-1"`），并用 `aria-live` 播报页面标题 ——
 * 否则读屏用户只听到「页面变了」，不知道变了什么。
 *
 * 两条例外，都是有理由的：
 * - **首次挂载不抢焦点。** 页面刚打开时，焦点还该留在浏览器这一侧。
 * - **触发切换的控件自己管焦点时不抢。** 榜单切换是页内的 Tab 组，焦点必须跟着
 *   选中项走（交互规范 §8.7）；页面标题不能把焦点从 Tab 上拽走。这样的控件用
 *   `data-owns-focus` 标出来 —— 例外挂在控件自己身上，而不是笼统地写成
 *   「焦点在 `<main>` 里就不抢」：那样一来，页面里任何一个会换页的链接都会
 *   失去焦点归属，读屏用户会掉回文档开头。
 */
function RouteFocus() {
  const { pathname } = useLocation();
  const previous = useRef<string | null>(null);
  const live = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 第一次挂载不算「切换」；StrictMode 的重复执行也不算。
    const changed = previous.current !== null && previous.current !== pathname;
    previous.current = pathname;
    if (!changed) return;

    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("[data-owns-focus]")) return;

    let cancelled = false;

    const focusHeading = (): boolean => {
      if (cancelled) return false;
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return false;
      // 兜底：页面忘了写 tabindex="-1" 时，焦点就落不到标题上。
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus();
      /* 播报页面标题。live region 的文本直接写进 DOM —— React 不接管它的子节点，
         所以下一次渲染不会把播报内容清掉。 */
      if (live.current) live.current.textContent = heading.textContent?.trim() ?? "";
      return true;
    };

    if (focusHeading()) return;

    /* 新页面还在读数据 —— 骨架屏阶段没有 `h1`。等它出现再聚焦，否则读屏用户
       只会听到「页面变了」，不知道变成了哪一页。上限 5 秒：一个永远不出现的
       标题不该留下一个观察者。 */
    const main = document.querySelector("main");
    if (!main) return;

    const observer = new MutationObserver(() => {
      /* 这 5 秒里用户可能已经自己点了别处 —— 那时候把焦点拽回标题是在抢。 */
      const now = document.activeElement;
      const idle =
        now === null || now === document.body || now === document.documentElement;
      if (idle && focusHeading()) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    const timer = setTimeout(() => observer.disconnect(), 5000);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [pathname]);

  return <div ref={live} aria-live="polite" className="sr-only" />;
}

/**
 * 页面访问计数。
 *
 * 首屏用 `document.referrer` 判断来路；之后的站内跳转都算 `internal` ——
 * `document.referrer` 描述的是**文档**从哪来，不会随 SPA 换页更新，直接沿用它
 * 会把每一次站内点击都记成外站来源。
 *
 * 只发路由**类别**（`home` / `inspect` / …），不带用户名、查询串或路径参数。
 */
function usePageView() {
  const { pathname, search } = useLocation();
  const firstLoad = useRef(true);

  useEffect(() => {
    const referrer = firstLoad.current ? document.referrer : window.location.origin;
    firstLoad.current = false;
    trackPageView(pathname, search, referrer);
  }, [pathname, search]);
}

/**
 * 应用外壳。
 *
 * 三个版面对应三条产品线：Dashboard（M2）、Hero Grid（M3）、Match Panel（M5）。
 */
export function App() {
  usePageView();
  const { t } = useI18n();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[var(--z-toast)] focus:rounded-sm focus:bg-surface-overlay focus:px-4 focus:py-2 focus:text-sm focus:text-fg-primary"
      >
        {t("跳到主要内容")}
      </a>

      <RouteFocus />

      <SiteHeader />

      <main id="main" className="flex-1">
        <Routes>
          <Route path="/" element={<LandingRoute />} />
          <Route path="/u/:username" element={<InspectRoute />} />
          <Route path="/u/:username/repos" element={<ReposRoute />} />
          <Route path="/b/:board" element={<BoardRoute />} />
          <Route path="/how" element={<HowRoute />} />
          <Route path="/manage" element={<ManageRoute />} />
          <Route path="/takedown" element={<TakedownRoute />} />
          <Route path="*" element={<LandingRoute />} />
        </Routes>
      </main>

      <SiteFooter />
    </div>
  );
}
