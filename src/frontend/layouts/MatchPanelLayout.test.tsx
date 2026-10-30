import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardId, BoardPayload, Envelope } from "@/shared/contract";
import { setActiveLocale } from "@/shared/i18n";
import { MatchPanelLayout } from "@/frontend/layouts/MatchPanelLayout";

function makeBoard(id: BoardId): BoardPayload {
  return {
    id,
    name: id === "embers" ? "余烬未熄榜" : "最长沉睡榜",
    description: "描述。",
    criteria: "收录条件：测试。",
    entries: [],
    delistedCount: 0,
  };
}

function makeEnvelope(id: BoardId): Envelope<BoardPayload> {
  return {
    data: makeBoard(id),
    completeness: "complete",
    missingPages: [],
    readAt: "2026-10-30T12:00:00.000Z",
  };
}

describe("MatchPanelLayout 的榜单切换", () => {
  it("高亮的榜单就是正在显示的那一个", () => {
    render(<MatchPanelLayout envelope={makeEnvelope("embers")} />);
    // 数据是余烬榜，高亮的就不能是最长沉睡榜 ——
    // 否则「高亮的榜单」和「表里的数据」各说各话。
    expect(screen.getByRole("tab", { name: "余烬未熄榜" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "最长沉睡榜" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "余烬未熄榜" }),
    ).toBeInTheDocument();
  });

  it("点 Tab 把意图交给父级的数据源", () => {
    const onSwitch = vi.fn();
    render(<MatchPanelLayout envelope={makeEnvelope("longest-sleep")} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole("tab", { name: "余烬未熄榜" }));
    expect(onSwitch).toHaveBeenCalledWith("embers");
  });

  it("方向键也能切 Tab（交互规范 §8.7）", () => {
    const onSwitch = vi.fn();
    render(<MatchPanelLayout envelope={makeEnvelope("longest-sleep")} onSwitch={onSwitch} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "最长沉睡榜" }), { key: "ArrowRight" });
    expect(onSwitch).toHaveBeenCalledWith("embers");
  });
});

/**
 * 榜单名、说明与收录条件由服务端本地化后下发；页面自己的文案（Tab 名、
 * 表头、空态、陈旧说明）来自 `t()`。两者在英语界面下都要是英语，但**数据
 * 不被二次翻译** —— 信封里写的是什么，标题就显示什么。
 */
describe("MatchPanelLayout 的语言切换", () => {
  it("英语界面：Tab 名跟着语言走，榜单数据原样渲染", () => {
    setActiveLocale("en");
    render(<MatchPanelLayout envelope={makeEnvelope("embers")} />);

    expect(screen.getByRole("tab", { name: "Embers Still Burning" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Longest Slumber" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    /* 榜单名是服务端下发的事实，客户端不再翻译一遍。 */
    expect(
      screen.getByRole("heading", { level: 1, name: "余烬未熄榜" }),
    ).toBeInTheDocument();
  });

  it("英语界面：空态是英语", () => {
    setActiveLocale("en");
    render(<MatchPanelLayout envelope={makeEnvelope("longest-sleep")} />);

    expect(screen.getByText("No repository dwells here yet.")).toBeInTheDocument();
  });

  it("英语界面：陈旧说明用英语时长，不是中文「天」", () => {
    setActiveLocale("en");
    const stale: Envelope<BoardPayload> = {
      ...makeEnvelope("longest-sleep"),
      /* 2.4 天 → 向上取整 3 天；超过 24 小时才算陈旧。 */
      readAt: new Date(Date.now() - 2.4 * 24 * 3_600_000).toISOString(),
    };
    render(<MatchPanelLayout envelope={stale} />);

    expect(screen.getByText("Board data is 3 days old.")).toBeInTheDocument();
    expect(screen.queryByText(/天前的/)).toBeNull();
  });
});
