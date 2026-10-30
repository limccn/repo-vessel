// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_UPSTREAM_LOOKUPS, getRepo, resolveUpstreams } from "@/worker/github/repos";
import type { GitHubRepo } from "@/worker/github/users";

const ENV = { GITHUB_API_TOKEN: "test-token" };

function repo(name: string, extra: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name,
    full_name: `limccn/${name}`,
    owner: { login: "limccn", type: "User" },
    fork: true,
    ...extra,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getRepo", () => {
  it("读单个仓库，带上编码后的 owner / name", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://api.github.com/repos/limccn/vessel");
      return json(repo("vessel"));
    });
    vi.stubGlobal("fetch", mock);

    const result = await getRepo(ENV, "limccn", "vessel");
    expect(result.name).toBe("vessel");
  });
});

describe("resolveUpstreams", () => {
  it("把补读到的 parent 挂回 Fork；非 Fork 不发请求", async () => {
    const mock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/repos/limccn/ashes") {
        return json({
          ...repo("ashes"),
          parent: {
            name: "kit",
            full_name: "someone/kit",
            owner: { login: "someone", type: "User" },
            pushed_at: "2019-01-01T00:00:00Z",
          },
        });
      }
      return json({ message: "Not Found" }, 404);
    });
    vi.stubGlobal("fetch", mock);

    const fork = repo("ashes");
    const original = repo("vessel", { fork: false });
    await resolveUpstreams(ENV, [fork, original]);

    expect(fork.parent?.full_name).toBe("someone/kit");
    expect(original.parent).toBeUndefined();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("补读失败时保持未解析，不抛错、不影响其余仓库", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ message: "boom" }, 500)),
    );

    const fork = repo("ashes");
    await expect(resolveUpstreams(ENV, [fork])).resolves.toBeUndefined();
    expect(fork.parent).toBeUndefined();
  });

  it("已经有 parent 的 Fork 不再补读", async () => {
    const mock = vi.fn(async () => json({}));
    vi.stubGlobal("fetch", mock);

    const fork = repo("ashes", {
      parent: {
        name: "kit",
        full_name: "someone/kit",
        owner: { login: "someone", type: "User" },
      },
    });
    await resolveUpstreams(ENV, [fork]);

    expect(mock).not.toHaveBeenCalled();
  });

  it("补读数量有上限 —— 超出的 Fork 保持 unresolved", async () => {
    const mock = vi.fn(async () => json({ message: "Not Found" }, 404));
    vi.stubGlobal("fetch", mock);

    const forks = Array.from({ length: MAX_UPSTREAM_LOOKUPS + 5 }, (_, index) =>
      repo(`r${index}`),
    );
    await resolveUpstreams(ENV, forks);

    expect(mock).toHaveBeenCalledTimes(MAX_UPSTREAM_LOOKUPS);
  });
});
