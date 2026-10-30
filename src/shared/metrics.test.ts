import { describe, expect, it } from "vitest";
import {
  classifyReferrer,
  classifyUserPageRequest,
  isClientMetricEvent,
  isValidMetricDim,
  pageViewDim,
  routeFromPath,
} from "./metrics";

describe("routeFromPath", () => {
  it("把七条真实路由映射成类别", () => {
    expect(routeFromPath("/")).toBe("home");
    expect(routeFromPath("/u/alice")).toBe("inspect");
    expect(routeFromPath("/u/alice/repos")).toBe("repos");
    expect(routeFromPath("/b/longest-sleep")).toBe("board");
    expect(routeFromPath("/how")).toBe("how");
    expect(routeFromPath("/manage")).toBe("manage");
    expect(routeFromPath("/takedown")).toBe("takedown");
  });

  it("忽略查询串与尾部斜杠，未知路径归 other", () => {
    expect(routeFromPath("/u/alice/?from=share")).toBe("inspect");
    expect(routeFromPath("/nope/at/all")).toBe("other");
    expect(routeFromPath("/u/alice/extra")).toBe("other");
  });

  it("绝不把路径片段带出来", () => {
    expect(routeFromPath("/u/secret-name")).toBe("inspect");
  });
});

describe("classifyReferrer", () => {
  const origin = "https://repovessel.lmlh.net";

  it("分享标记优先", () => {
    expect(classifyReferrer(null, origin, true)).toBe("share");
    expect(classifyReferrer("https://repovessel.lmlh.net/u/a", origin, true)).toBe("share");
  });

  it("没有 referrer 是 direct，同站是 internal，外站是 external", () => {
    expect(classifyReferrer(null, origin)).toBe("direct");
    expect(classifyReferrer("", origin)).toBe("direct");
    expect(classifyReferrer(`${origin}/b/embers`, origin)).toBe("internal");
    expect(classifyReferrer("https://github.com/limccn/repo-vessel", origin)).toBe("external");
  });

  it("读不懂的 referrer 不猜成外站", () => {
    expect(classifyReferrer("not a url", origin)).toBe("direct");
    expect(classifyReferrer("https://example.com/x", null)).toBe("external");
  });
});

describe("pageViewDim", () => {
  it("只由受控词表拼成", () => {
    expect(pageViewDim("inspect", "share")).toBe("route=inspect,src=share");
    expect(isValidMetricDim("page_view", pageViewDim("home", "direct"))).toBe(true);
  });
});

describe("classifyUserPageRequest", () => {
  const url = "https://repovessel.lmlh.net/u/alice";

  it("爬虫优先，哪怕是分享链接", () => {
    expect(
      classifyUserPageRequest(`${url}?from=share`, "https://t.co/x", "Twitterbot/1.0"),
    ).toBe("crawler");
    expect(classifyUserPageRequest(url, null, "facebookexternalhit/1.1")).toBe("crawler");
  });

  it("带分享标记的链接算分享", () => {
    expect(classifyUserPageRequest(`${url}?from=share`, null, "Mozilla/5.0")).toBe("share");
  });

  it("外站 referrer 算分享，同站刷新算 direct", () => {
    expect(
      classifyUserPageRequest(url, "https://weibo.com/x", "Mozilla/5.0"),
    ).toBe("share");
    expect(
      classifyUserPageRequest(url, "https://repovessel.lmlh.net/b/embers", "Mozilla/5.0"),
    ).toBe("direct");
    expect(classifyUserPageRequest(url, null, "Mozilla/5.0")).toBe("direct");
  });
});

describe("isClientMetricEvent", () => {
  it("只放行浏览器能发的三种", () => {
    expect(isClientMetricEvent("page_view")).toBe(true);
    expect(isClientMetricEvent("share_card")).toBe(true);
    expect(isClientMetricEvent("topic_copy")).toBe(true);
    expect(isClientMetricEvent("inspect_read")).toBe(false);
    expect(isClientMetricEvent("collect_run")).toBe(false);
    expect(isClientMetricEvent("")).toBe(false);
    expect(isClientMetricEvent(null)).toBe(false);
  });
});

describe("isValidMetricDim", () => {
  it("每个事件的合法 dim", () => {
    expect(isValidMetricDim("page_view", "route=board,src=internal")).toBe(true);
    expect(isValidMetricDim("share_card", "ok")).toBe(true);
    expect(isValidMetricDim("share_card", "failed")).toBe(true);
    expect(isValidMetricDim("topic_copy", "topic=repo-vessel")).toBe(true);
    expect(isValidMetricDim("inspect_read", "partial")).toBe(true);
    expect(isValidMetricDim("inspect_read", "failed:rate_limited")).toBe(true);
    expect(isValidMetricDim("claim_action", "claim:ok")).toBe(true);
    expect(isValidMetricDim("claim_action", "claim:not_enrolled")).toBe(true);
    expect(isValidMetricDim("claim_action", "hide:error:upstream_unavailable")).toBe(true);
    expect(isValidMetricDim("takedown_submit", "received")).toBe(true);
    expect(isValidMetricDim("userpage_view", "src=crawler")).toBe(true);
    expect(isValidMetricDim("collect_run", "verified_reads")).toBe(true);
  });

  it("拒绝越界与自由文本", () => {
    expect(isValidMetricDim("page_view", "route=/u/alice,src=direct")).toBe(false);
    expect(isValidMetricDim("page_view", "route=HOME,src=direct")).toBe(false);
    expect(isValidMetricDim("topic_copy", "topic=Repo Vessel")).toBe(false);
    expect(isValidMetricDim("share_card", "http://example.com")).toBe(false);
    expect(isValidMetricDim("inspect_read", "failed:Not A Code")).toBe(false);
    expect(isValidMetricDim("claim_action", "claim:whatever")).toBe(false);
    expect(isValidMetricDim("userpage_view", "src=bot")).toBe(false);
    expect(isValidMetricDim("collect_run", "x".repeat(65))).toBe(false);
  });

  it("dim 的空串只对没有维度的事件成立", () => {
    expect(isValidMetricDim("takedown_submit", "")).toBe(false);
    expect(isValidMetricDim("collect_run", "")).toBe(false);
  });
});
