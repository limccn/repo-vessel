/**
 * 客户端计数。
 *
 * 守住四条：受控词汇、隐私信号、信标优先、永远不抛。
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { track, trackPageView } from "./analytics";

interface Sent {
  event: string;
  dim: string;
}

async function lastBeacon(
  beacon: ReturnType<typeof beaconEnv>,
): Promise<Sent> {
  const blob = beacon.mock.calls.at(-1)?.[1];
  expect(blob).toBeInstanceOf(Blob);
  return JSON.parse(await (blob as Blob).text()) as Sent;
}

function beaconEnv(navigatorOverrides: Record<string, unknown> = {}) {
  const beacon = vi.fn((_url?: string, _data?: Blob) => true);
  vi.stubGlobal("navigator", { doNotTrack: null, sendBeacon: beacon, ...navigatorOverrides });
  return beacon;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("track", () => {
  it("优先走 sendBeacon，body 就是事件与维度", async () => {
    const beacon = beaconEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    track("page_view", "route=home,src=direct");

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]?.[0]).toBe("/api/metrics/event");
    expect(await lastBeacon(beacon)).toEqual({
      event: "page_view",
      dim: "route=home,src=direct",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("没有 sendBeacon 时退回 fetch，并带 keepalive", () => {
    vi.stubGlobal("navigator", { doNotTrack: null });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    track("share_card", "ok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/metrics/event",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        body: JSON.stringify({ event: "share_card", dim: "ok" }),
      }),
    );
  });

  it("sendBeacon 返回 false 或抛错时，都还有 fetch 这一条路", () => {
    const falseBeacon = vi.fn(() => false);
    vi.stubGlobal("navigator", { doNotTrack: null, sendBeacon: falseBeacon });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", fetchMock);

    track("share_card", "ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const throwingBeacon = vi.fn(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal("navigator", { doNotTrack: null, sendBeacon: throwingBeacon });
    track("share_card", "failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("Do Not Track 开启时一条都不发", () => {
    const beacon = beaconEnv({ doNotTrack: "1" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    track("page_view", "route=home,src=direct");

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Global Privacy Control 开启时一条都不发", () => {
    const beacon = beaconEnv({ globalPrivacyControl: true });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    track("page_view", "route=home,src=direct");

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("维度不合法就静默丢掉 —— 不让用户看到一个失败请求", () => {
    const beacon = beaconEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    track("page_view", "route=/u/alice,src=direct");
    track("topic_copy", "topic=Repo Vessel");

    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetch 抛错也不外传", () => {
    vi.stubGlobal("navigator", { doNotTrack: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("offline");
      }),
    );

    expect(() => track("share_card", "ok")).not.toThrow();
  });
});

describe("trackPageView", () => {
  it("首屏直访记成 direct，只带路由类别", async () => {
    const beacon = beaconEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    trackPageView("/u/alice", "", "");

    expect(await lastBeacon(beacon)).toEqual({
      event: "page_view",
      dim: "route=inspect,src=direct",
    });
  });

  it("?from=share 记成 share —— 微信会剥掉 referrer，标记还在", async () => {
    const beacon = beaconEnv();

    trackPageView("/u/alice", "?from=share", "");

    expect(await lastBeacon(beacon)).toEqual({
      event: "page_view",
      dim: "route=inspect,src=share",
    });
  });

  it("外站 referrer 记成 external，同站记成 internal", async () => {
    const beacon = beaconEnv();

    trackPageView("/b/embers", "", "https://weibo.com/x");
    expect((await lastBeacon(beacon)).dim).toBe("route=board,src=external");

    trackPageView("/b/embers", "", `${window.location.origin}/u/alice`);
    expect((await lastBeacon(beacon)).dim).toBe("route=board,src=internal");
  });

  it("不认识的路径只到 other，路径本身不出门", async () => {
    const beacon = beaconEnv();

    trackPageView("/u/secret-name/extra", "", "");

    const sent = await lastBeacon(beacon);
    expect(sent.dim).toBe("route=other,src=direct");
    expect(JSON.stringify(sent)).not.toContain("secret-name");
  });
});
