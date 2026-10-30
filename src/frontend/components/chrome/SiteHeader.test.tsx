import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "@/frontend/components/chrome/SiteHeader";

/**
 * 站点头部。
 *
 * 窄屏上导航换到第二行，靠的是 `order-last` + `w-full` —— 只改**视觉**顺序。
 * 这里钉住的是它不改的那两件事：DOM 顺序，以及换行断点在两处保持一致。
 *
 * jsdom 不做布局，所以量不了「是不是真的换行了」；能钉、也值得钉的是
 * 「读屏与 Tab 顺序没被 `order` 挪动」和「两处断点没走散」。
 */
function row(container: HTMLElement): HTMLElement {
  return container.querySelector("header > div") as HTMLElement;
}

describe("SiteHeader", () => {
  it("DOM 顺序仍是 品牌 → 导航 → 登录，`order-last` 只挪了视觉", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    const r = row(container);
    const brand = r.querySelector("a") as Node;
    const nav = r.querySelector("nav") as Node;
    /* 登录是真实的 `<a href="/api/auth/login">` —— 登录必须是一次整页跳转，
       不能由脚本代劳。未登录是首帧的默认态，所以这个链接一定在 DOM 里。 */
    const signIn = r.querySelector('a[href="/api/auth/login"]') as Node;

    expect(signIn).not.toBeNull();

    /* Tab 顺序跟 DOM 走，不跟 CSS 的 `order` 走 —— 所以导航在视觉上排到最后，
       DOM 里仍必须夹在品牌与登录之间。 */
    expect(brand.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nav.compareDocumentPosition(signIn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("导航有可及名称，三个入口都在", () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "主导航" });
    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(3);
  });

  it("页头没有语言控件 —— 语言跟浏览器走，登录后再在 /manage 里选", () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    /* 语言不再是一个页头控件：访客拿到的是浏览器语言，登录用户的语言偏好
       记在会话里、在 /manage 里改。页头里出现任何分段控件都是回退。 */
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("换行断点在容器与导航上一致 —— 一处改成 lg，另一处必须跟着改", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );

    const r = row(container);
    const nav = r.querySelector("nav") as HTMLElement;

    /* 容器用 `md:flex-nowrap` 收起换行，导航用 `md:order-none md:w-auto` 回到
       同一行。两个断点必须相同：不一致时会出现「容器已不换行、导航还要独占整行」
       的中间态，导航被挤成一条横向滚动条。 */
    expect(r.className).toContain("md:flex-nowrap");
    expect(nav.className).toContain("md:w-auto");
    expect(nav.className).toContain("md:order-none");

    for (const cls of [r.className, nav.className]) {
      expect(cls).not.toContain("sm:flex-nowrap");
      expect(cls).not.toContain("sm:w-auto");
    }
  });
});
