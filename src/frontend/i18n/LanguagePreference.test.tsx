/**
 * 语言偏好控件与 `LocaleProvider` 的登录偏好同步。
 *
 * 守三件事：切换真的发生（整棵子树换语言、`<html lang>` 跟着换）；中文的
 * 简／繁由**浏览器地区**决定，不由用户选；偏好真的发给 Worker 存进会话
 * Cookie —— 存失败时只提示，不回滚已经生效的界面。
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguagePreference } from "@/frontend/i18n/LanguagePreference";
import { LocaleProvider, useI18n } from "@/frontend/i18n/LocaleProvider";
import { getActiveLocale, t } from "@/shared/i18n";

function Probe() {
  const { t, locale } = useI18n();
  return (
    <p>
      <span data-testid="site-name">{t("码之灵龛")}</span>
      <span data-testid="locale">{locale}</span>
    </p>
  );
}

function renderPreference() {
  return render(
    <BrowserRouter>
      <LocaleProvider>
        <LanguagePreference />
        <Probe />
      </LocaleProvider>
    </BrowserRouter>,
  );
}

/** 记下每一次请求，按 URL 取那一条。`ok: false` 模拟保存失败。 */
function stubFetch(ok = true) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: ok ? 204 : 500 });
    }),
  );
  return {
    calls,
    localeCall: () => calls.find((call) => call.url.includes("/api/session/locale")),
  };
}

function setBrowserLanguages(languages: string[]) {
  Object.defineProperty(navigator, "languages", { value: languages, configurable: true });
}

/** 已登录的桩：`/api/auth/session` 回一条 `{ login, lang }`，其余请求照旧。 */
function stubSignedInSession(lang: "en" | "zh" | "ja" | null) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/api/auth/session")) {
        return new Response(JSON.stringify({ login: "alice", lang }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(null, { status: 204 });
    }),
  );
  return calls;
}

describe("LanguagePreference", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/manage");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // 测试环境默认把浏览器语言钉在 zh-CN（见 `src/frontend/test/setup.ts`）。
    setBrowserLanguages(["zh-CN"]);
  });

  it("三个选项，名称用语言自己的写法", () => {
    stubFetch();
    renderPreference();

    const group = screen.getByRole("group", { name: "语言偏好" });
    expect(group).toBeInTheDocument();

    for (const name of ["ENGLISH", "中文", "日本語"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("当前语言用 aria-pressed 标出", () => {
    stubFetch();
    renderPreference();

    expect(screen.getByRole("button", { name: "中文" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "ENGLISH" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("选日语，整个界面换成日语并把偏好发给 Worker", async () => {
    const user = userEvent.setup();
    const fetchStub = stubFetch();
    renderPreference();

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("ja");
    expect(screen.getByTestId("site-name")).toHaveTextContent("コードの霊龕");
    expect(getActiveLocale()).toBe("ja");

    const call = fetchStub.localeCall();
    expect(call?.init?.method).toBe("POST");
    expect(JSON.parse(String(call?.init?.body))).toEqual({ lang: "ja" });
  });

  it("选中文时，繁体地区的浏览器得到繁体", async () => {
    const user = userEvent.setup();
    const fetchStub = stubFetch();
    setBrowserLanguages(["zh-TW", "en-US"]);
    renderPreference();

    await user.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("zh-Hant");
    // 「当前显示」那一行报的是真正生效的文字，不是用户点的那两个字。
    expect(screen.getByText(/繁體中文/)).toBeInTheDocument();
    // 存的是「中文」，不是具体到简／繁 —— 换一台浏览器也能各自落到对的写法。
    expect(JSON.parse(String(fetchStub.localeCall()?.init?.body))).toEqual({ lang: "zh" });
  });

  it("选中文时，浏览器里没有中文就落到简体", async () => {
    const user = userEvent.setup();
    stubFetch();
    setBrowserLanguages(["en-US"]);
    renderPreference();

    await user.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("zh-Hans");
  });

  it("切换到英语同时更新 <html lang> 与文档标题", async () => {
    const user = userEvent.setup();
    stubFetch();
    renderPreference();

    await user.click(screen.getByRole("button", { name: "ENGLISH" }));

    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toContain("Repo Vessel");
  });

  it("保存失败只提示，不回滚已经生效的语言", async () => {
    const user = userEvent.setup();
    stubFetch(false);
    renderPreference();

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("ja");
    /* 提示跟着**当前**语言走 —— 界面已经切到日语，提示就该是日语的。 */
    expect(screen.getByRole("status")).toHaveTextContent(
      t("偏好没有保存成功，本次浏览仍然使用新语言。", undefined, "ja"),
    );
  });

  it("没有 ?lang= 时，登录偏好生效", async () => {
    stubSignedInSession("ja");
    renderPreference();

    await waitFor(() => expect(screen.getByTestId("locale")).toHaveTextContent("ja"));
    expect(document.documentElement.lang).toBe("ja");
  });

  it("URL 上有 ?lang= 时，账号偏好不覆盖它，也不再问会话", () => {
    window.history.replaceState(null, "", "/manage?lang=en");
    const calls = stubSignedInSession("ja");
    renderPreference();

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(calls.filter((url) => url.includes("/api/auth/session"))).toHaveLength(0);
  });

  it("用户先按了语言，后到的账号偏好不把它顶回去", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (String(input).includes("/api/auth/session")) {
          await gate;
          return new Response(JSON.stringify({ login: "alice", lang: "ja" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 204 });
      }),
    );

    renderPreference();
    await user.click(screen.getByRole("button", { name: "ENGLISH" }));
    expect(screen.getByTestId("locale")).toHaveTextContent("en");

    /* 会话请求现在才回来 —— 点击比它新，界面必须留在英语。 */
    await act(async () => {
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
