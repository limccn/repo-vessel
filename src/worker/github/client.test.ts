// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubError, githubFetch, hasNextPage } from "@/worker/github/client";

const ENV = { GITHUB_API_TOKEN: "test-token" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function stubFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(new URL(String(input)), init),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("githubFetch", () => {
  it("缺令牌时直接失败，并且不发请求 —— 绝不回落匿名", async () => {
    const mock = stubFetch(() => json({}));

    await expect(githubFetch({}, "/users/limccn")).rejects.toMatchObject({
      kind: "unconfigured",
      status: 503,
    });
    expect(mock).not.toHaveBeenCalled();
  });

  it("带上认证头、API 版本与 UA", async () => {
    const mock = stubFetch(() => json({ login: "limccn" }));

    const response = await githubFetch<{ login: string }>(ENV, "/users/limccn");
    expect(response.data.login).toBe("limccn");

    const init = mock.mock.calls[0]?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-token");
    expect(headers["x-github-api-version"]).toBe("2022-11-28");
    expect(headers["user-agent"]).toContain("repo-vessel");
  });

  it("304 是「没变」，不是失败，也不是数据", async () => {
    stubFetch(() => new Response(null, { status: 304 }));
    const response = await githubFetch<unknown>(ENV, "/users/limccn");
    expect(response.ok).toBe(false);
    expect(response.data).toBeNull();
  });

  it("404 归为 not-found", async () => {
    stubFetch(() => json({ message: "Not Found" }, 404));
    await expect(githubFetch(ENV, "/users/nobody")).rejects.toMatchObject({
      kind: "not-found",
      status: 404,
    });
  });

  it("403 带 Retry-After 时按秒记下重试时间", async () => {
    stubFetch(() => json({ message: "slow down" }, 403, { "retry-after": "30" }));
    const error = await githubFetch(ENV, "/users/limccn").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitHubError);
    expect(error).toMatchObject({ kind: "rate-limited", retryAfter: 30 });
  });

  it("403 没有 Retry-After 时退到 x-ratelimit-reset（epoch 秒）", async () => {
    stubFetch(() => json({ message: "rate limited" }, 403, { "x-ratelimit-reset": "1700000000" }));
    await expect(githubFetch(ENV, "/users/limccn")).rejects.toMatchObject({
      kind: "rate-limited",
      retryAfter: 1700000000,
    });
  });

  it("429 同样是 rate-limited", async () => {
    stubFetch(() => json({ message: "too many" }, 429));
    await expect(githubFetch(ENV, "/users/limccn")).rejects.toMatchObject({
      kind: "rate-limited",
    });
  });

  it("5xx 是 upstream unavailable", async () => {
    stubFetch(() => json({ message: "boom" }, 500));
    await expect(githubFetch(ENV, "/users/limccn")).rejects.toMatchObject({
      kind: "unavailable",
      status: 502,
    });
  });

  it("网络中断是 upstream unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(githubFetch(ENV, "/users/limccn")).rejects.toMatchObject({
      kind: "unavailable",
    });
  });

  it("被 abort 时是 timeout", async () => {
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));

    await expect(githubFetch(ENV, "/users/limccn")).rejects.toMatchObject({
      kind: "timeout",
      status: 504,
    });
  });
});

describe("hasNextPage", () => {
  it("只认 Link 头里的 rel=\"next\"", () => {
    expect(
      hasNextPage(
        new Headers({
          link: '<https://api.github.com/user/1/repos?page=2>; rel="next", <https://api.github.com/user/1/repos?page=9>; rel="last"',
        }),
      ),
    ).toBe(true);
    expect(
      hasNextPage(new Headers({ link: '<https://api.github.com/user/1/repos?page=1>; rel="prev"' })),
    ).toBe(false);
    expect(hasNextPage(new Headers())).toBe(false);
  });
});
