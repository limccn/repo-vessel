import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { siteCopy } from "@/shared/copy";
import { OctocatIcon } from "@/frontend/components/common/OctocatIcon";
import { useI18n } from "@/frontend/i18n/LocaleProvider";
import { SIGN_IN_URL, fetchSession, signOut, type SessionInfo } from "@/frontend/lib/auth";
import { buttonClassName } from "@/frontend/lib/button";
import { cx } from "@/frontend/lib/cx";

/**
 * 站点头部。导航 + GitHub 登录态。
 *
 * **页头没有语言控件。** 语言由浏览器自动决定；登录之后可以在 `/manage`
 * 里记住偏好。页头只留三件与「去哪」有关的东西：品牌、导航、登录态。
 */
export function SiteHeader() {
  const { t, locale } = useI18n();
  const copy = siteCopy(locale);

  const nav = [
    { to: "/", label: copy.nav.inspect, end: true },
    { to: "/b/longest-sleep", label: copy.nav.boards, end: false },
    { to: "/how", label: copy.nav.how, end: false },
  ] as const;

  /* 登录态只有一个来源：Worker 的 `/api/auth/session`。首帧按未登录渲染
     （那是可用的默认态），拿到结果再切换 —— 不做骨架屏，头部不来回跳。 */
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSession(controller.signal).then(setSession);
    return () => controller.abort();
  }, []);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-hairline-soft bg-bg-base/85 backdrop-blur">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:flex-nowrap sm:px-6">
        <Link to="/" className="flex flex-none items-center gap-2 no-underline">
          <svg
            viewBox="0 0 64 64"
            width="28"
            height="28"
            aria-hidden="true"
            className="shrink-0"
          >
            <path
              d="M22 16h20v6l-4 5v16l6 6v5H20v-5l6-6V27l-4-5z"
              fill="none"
              stroke="var(--color-gold)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <circle cx="32" cy="43" r="3.5" fill="var(--color-teal)" />
          </svg>
          <span className="display-cn text-sm text-fg-primary">
            {copy.siteName}
            {/* 拉丁名在窄屏上让位给导航 —— 品牌名本身永远在。 */}
            {copy.siteNameLatin ? (
              <span className="hidden text-fg-muted sm:inline">
                {" "}
                · {copy.siteNameLatin}
              </span>
            ) : null}
          </span>
        </Link>

        {/* 窄屏上导航**独占一行**（`order-last` + `w-full`），登录按钮留在
            第一行。挤在一行里的话，320px 的屏放不下「品牌 + 三个导航 + 登录」
            —— 先断行的是导航，它在第二行可以横向滚动，而不是把布局撑破。

            `order` 只改**视觉**顺序：Tab 顺序跟 DOM 走，所以 DOM 永远是
            「品牌 → 导航 → 登录」，桌面端（`md:order-none`）与之一致，
            窄屏把导航挪到第二行。 */}
        <nav
          aria-label={t("主导航")}
          className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1"
        >
          <ul className="flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      "inline-block whitespace-nowrap rounded-sm px-3 py-1.5 text-xs no-underline",
                      "transition-colors duration-[var(--motion-duration-fast)]",
                      isActive
                        ? "bg-surface-panel text-fg-primary"
                        : "text-fg-secondary hover:bg-surface-panel hover:text-fg-primary",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-none items-center gap-2">
          {session ? (
            <>
              {/* `/manage` 是改语言偏好的唯一入口，窄屏上也不能藏起来 ——
                  它曾经是 `hidden sm:inline`，那会让手机上的登录用户无处可去。 */}
              <Link
                to="/manage"
                className="max-w-[6rem] truncate text-xs text-fg-secondary no-underline hover:text-fg-primary sm:max-w-[9rem]"
              >
                @{session.login}
              </Link>
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => setSession(null));
                }}
                className={buttonClassName("ghost", "sm", "min-h-10 flex-none")}
              >
                {t("退出")}
              </button>
            </>
          ) : (
            <a
              href={SIGN_IN_URL}
              aria-label={copy.nav.signIn}
              className={buttonClassName(
                "secondary",
                "sm",
                "min-h-10 min-w-10 flex-none px-3",
              )}
            >
              <OctocatIcon />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
