import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_STORAGE_KEY } from "@/shared/i18n";
import { LocaleProvider } from "@/frontend/i18n/LocaleProvider";
import { ManageRoute } from "@/frontend/routes/ManageRoute";

/**
 * 登录失败的原因码 —— 每个码有自己的句子。
 *
 * 原因码只在 URL 上（`?auth=`），从不作为界面文字出现；表里存的是 msgid，
 * 渲染时过 `t()`。这里钉住两件事：
 *
 * 1. 两个不同的码给出**不同**的句子 —— 合成一句「登录失败」会让用户不知道
 *    自己是取消了授权，还是站点没配置好。
 * 2. 换语言之后同一句话跟着换 —— 原因文案不是服务端下发的，而是客户端查表。
 */

function stubSession(login: string | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      login === null
        ? new Response(null, { status: 401 })
        : new Response(JSON.stringify({ login }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
    ),
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleProvider>
        <ManageRoute />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  stubSession(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ManageRoute 登录失败原因", () => {
  it("state 与 personal-only 说的是两件不同的事", async () => {
    const first = renderAt("/manage?auth=state");
    expect(
      await screen.findByText("这次登录请求已经过期了。重新点一次登录即可。"),
    ).toBeInTheDocument();
    first.unmount();

    renderAt("/manage?auth=personal-only");
    expect(
      await screen.findByText("本站只支持个人账户。组织账户没法登录，也不会被收录。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("这次登录请求已经过期了。重新点一次登录即可。"),
    ).not.toBeInTheDocument();
  });

  it("原因句随界面语言切换", async () => {
    /* `MemoryRouter` 的地址不会落到 `window.location`，所以语言走「本地保存的选择」
       这一层 —— 那也正是刷新之后语言保持不变的机制。 */
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    renderAt("/manage?auth=state");
    expect(
      await screen.findByText("This sign-in request has expired. Start the sign-in again."),
    ).toBeInTheDocument();
  });

  it("不认识的 reason 不编一句话", async () => {
    renderAt("/manage?auth=something-else");
    /* 未登录的提示照常出现，但「没有完成登录。」这条红色提示不该出现。 */
    expect(await screen.findByText("用 GitHub 登录")).toBeInTheDocument();
    expect(screen.queryByText("没有完成登录。")).not.toBeInTheDocument();
  });
});
