import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RepoSummary } from "@/shared/contract";
import { RepoCard } from "@/frontend/components/card/RepoCard";
import { setActiveLocale } from "@/shared/i18n";

function makeRepo(overrides: Partial<RepoSummary> = {}): RepoSummary {
  return {
    owner: "alice",
    name: "quiet-thing",
    fullName: "alice/quiet-thing",
    description: "一个很久没动过的仓库。",
    language: "TypeScript",
    starCount: 128,
    forkCount: 12,
    pushedAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2020-01-01T00:00:00.000Z",
    isFork: false,
    archived: false,
    topics: null,
    dormantDays: 240,
    tags: ["quiet"],
    upstream: null,
    ...overrides,
  };
}

describe("RepoCard", () => {
  it("渲染仓库名、沉睡天数与读取时间", () => {
    render(<RepoCard repo={makeRepo()} readAt="2026-10-30T12:00:00.000Z" />);
    // 主人与仓库名分属两个文本节点（主人弱化），按标题的可访问名匹配整串。
    expect(screen.getByRole("heading", { name: "alice/quiet-thing" })).toBeInTheDocument();
    expect(screen.getByText("240 天")).toBeInTheDocument();
    expect(screen.getByText(/读取于/)).toBeInTheDocument();
  });

  it("沉睡天数未知时显示「? 未知」，不显示 0", () => {
    render(<RepoCard repo={makeRepo({ dormantDays: null })} readAt="2026-10-30T12:00:00.000Z" />);
    expect(screen.getAllByText(/未知/).length).toBeGreaterThan(0);
    expect(screen.queryByText("0 天")).not.toBeInTheDocument();
  });

  it("Star 数未知时显示「? 未知」，不显示 0", () => {
    render(<RepoCard repo={makeRepo({ starCount: null })} readAt="2026-10-30T12:00:00.000Z" />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getAllByText(/未知/).length).toBeGreaterThan(0);
  });

  it("稀有度词永远出现，颜色只是冗余编码", () => {
    render(<RepoCard repo={makeRepo({ dormantDays: 1200 })} readAt="2026-10-30T12:00:00.000Z" />);
    expect(screen.getByText("传说")).toBeInTheDocument();
  });

  it("读取时间未知时不留空", () => {
    render(<RepoCard repo={makeRepo()} readAt={null} />);
    expect(screen.getAllByText(/未知/).length).toBeGreaterThan(0);
  });

  it("英语界面下卡片文案跟着换，仓库内容不翻译", () => {
    setActiveLocale("en");
    render(
      <RepoCard
        repo={makeRepo({ description: null, language: null, tags: [] })}
        readAt="2026-10-30T12:00:00.000Z"
      />,
    );
    expect(screen.getByText("This repository has no description.")).toBeInTheDocument();
    expect(screen.getByText("No language")).toBeInTheDocument();
    expect(screen.getByText("240 days")).toBeInTheDocument();
    /* 英语里时间在前：「Read 1 day ago」，不是「Read at 1 day ago」。 */
    expect(screen.getByText(/^Read \d/)).toBeInTheDocument();
    expect(screen.queryByText(/这个仓库没有写简介/)).not.toBeInTheDocument();
  });
});
