import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "@/frontend/App";

/**
 * 路由切换后的焦点管理（交互规范 §8.3）。
 *
 * 换页要把焦点移到新页面的 `<h1>`，并用 `aria-live` 播报页面标题；
 * 但首屏不能抢焦点，页内的 Tab 组也不能被页面标题把焦点拽走。
 */
describe("路由切换后的焦点", () => {
  it("首屏不抢焦点", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(document.activeElement).toBe(document.body);
  });

  it("换页后焦点落到新页面的 h1 上，并播报页面标题", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "围观榜单" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { level: 1, name: "最长沉睡榜" }),
      );
    });
    expect(
      document.querySelector("[aria-live='polite']")?.textContent,
    ).toContain("最长沉睡榜");
  });
});
