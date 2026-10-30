import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Envelope } from "@/shared/contract";
import { BoardRoute } from "@/frontend/routes/BoardRoute";
import { HowRoute } from "@/frontend/routes/HowRoute";

/**
 * M3 接线：榜单真数据与 `/how` 的收录状态检查器。
 *
 * 钉住三件事：
 *   - `?demo=` 仍然走假数据，原型的状态开关没有因为接真数据而失效；
 *   - 真数据走 `/api/board/:id`，信封里的名次原样渲染；
 *   - `unconfirmed` 有自己的文案与重试 —— 它不能被写成「没有主题」。
 */

const BOARD_ENVELOPE: Envelope<{
  id: "longest-sleep";
  name: string;
  description: string;
  criteria: string;
  entries: {
    rank: number;
    dormantDays: number | null;
    repo: Record<string, unknown>;
  }[];
  delistedCount: number | null;
}> = {
  data: {
    id: "longest-sleep",
    name: "最长沉睡榜",
    description: "它们没有走远，只是很久没有推送。",
    criteria: "收录条件：仓库带有主题，且沉睡 ≥ 181 天。",
    entries: [
      {
        rank: 1,
        dormantDays: 900,
        repo: {
          owner: "limccn",
          name: "deep-rest",
          fullName: "limccn/deep-rest",
          description: null,
          language: null,
          starCount: 4,
          forkCount: 0,
          pushedAt: "2024-01-01T00:00:00.000Z",
          createdAt: null,
          isFork: false,
          archived: false,
          topics: ["repo-vessel"],
          dormantDays: 900,
          tags: [],
          upstream: null,
        },
      },
    ],
    delistedCount: 0,
  },
  completeness: "complete",
  missingPages: [],
  readAt: new Date().toISOString(),
};

const UNCONFIRMED = {
  data: {
    fullName: "limccn/vessel",
    state: "unconfirmed",
    matchedTopic: null,
    verifiedAt: null,
  },
  completeness: "complete",
  missingPages: [],
  readAt: new Date().toISOString(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let calls: string[] = [];
let metricBodies: string[] = [];

beforeEach(() => {
  calls = [];
  metricBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/metrics/event") metricBodies.push(String(init?.body ?? ""));
      if (url.startsWith("/api/board/")) return jsonResponse(BOARD_ENVELOPE);
      if (url.startsWith("/api/collection-status")) return jsonResponse(UNCONFIRMED);
      return jsonResponse({}, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BoardRoute", () => {
  it("真数据走 /api/board/:id，名次原样渲染", async () => {
    render(
      <MemoryRouter initialEntries={["/b/longest-sleep"]}>
        <Routes>
          <Route path="/b/:board" element={<BoardRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    /* 窄屏卡片与宽屏表格是同一份数据的两次渲染（display 切换），
       所以这里断言「至少出现一次」，而不是钉住条数。 */
    expect((await screen.findAllByText("limccn/deep-rest")).length).toBeGreaterThan(0);
    expect(calls[0]).toBe("/api/board/longest-sleep");
  });

  it("?demo= 仍然走假数据，不打接口", async () => {
    render(
      <MemoryRouter initialEntries={["/b/embers?demo=stale"]}>
        <Routes>
          <Route path="/b/:board" element={<BoardRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "余烬未熄榜" }),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe("HowRoute 收录状态检查器", () => {
  it("unconfirmed 说的是「这次没能确认」，不是「没有主题」，并且可以重试", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/how"]}>
        <HowRoute />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("仓库名"), "limccn/vessel");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(await screen.findByText("这次没能确认")).toBeInTheDocument();
    expect(
      screen.getByText(/这不代表它没有主题/),
    ).toBeInTheDocument();

    /* 重试是 `unconfirmed` 自带的动作 —— 其他四态没有它。 */
    const retry = screen.getByRole("button", { name: "再查一次" });
    await user.click(retry);

    await waitFor(() => {
      expect(calls.filter((url) => url.startsWith("/api/collection-status"))).toHaveLength(2);
    });
  });

  it("复制主题成功才计数，维度是配置里的 slug", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/how"]}>
        <HowRoute />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "repo-vessel" }));

    await waitFor(() => {
      expect(metricBodies).toHaveLength(1);
    });
    expect(JSON.parse(metricBodies[0] ?? "")).toEqual({
      event: "topic_copy",
      dim: "topic=repo-vessel",
    });
    expect(screen.getByRole("button", { name: "repo-vessel · 已复制" })).toBeInTheDocument();
  });
});
