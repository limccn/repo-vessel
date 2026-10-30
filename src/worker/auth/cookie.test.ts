// @vitest-environment node
/** node 环境：`Request` / `Headers` 是 Node 自带的；jsdom 不实现 Fetch API。 */
import { describe, expect, it } from "vitest";
import { clearCookie, readCookie, serializeCookie } from "./cookie";

function requestWithCookie(header: string): Request {
  return new Request("https://example.com/", { headers: { cookie: header } });
}

describe("readCookie", () => {
  it("从多个 Cookie 里取出指定的那一个", () => {
    const request = requestWithCookie("a=1; rv_session=abc.def.ghi; b=2");
    expect(readCookie(request, "rv_session")).toBe("abc.def.ghi");
  });

  it("没有 Cookie 头时返回 null", () => {
    expect(readCookie(new Request("https://example.com/"), "rv_session")).toBeNull();
  });

  it("名字必须整段匹配（rv_session 不会命中 xrv_session）", () => {
    const request = requestWithCookie("xrv_session=nope");
    expect(readCookie(request, "rv_session")).toBeNull();
  });
});

describe("serializeCookie", () => {
  it("默认带上 HttpOnly / Secure / SameSite=Lax", () => {
    const value = serializeCookie("rv_session", "v1.a.b", { maxAge: 60 });
    expect(value).toContain("rv_session=v1.a.b");
    expect(value).toContain("Path=/");
    expect(value).toContain("Max-Age=60");
    expect(value).toContain("HttpOnly");
    expect(value).toContain("Secure");
    expect(value).toContain("SameSite=Lax");
  });

  it("删除时把值清空并置 Max-Age=0", () => {
    const value = clearCookie("rv_session");
    expect(value.startsWith("rv_session=;")).toBe(true);
    expect(value).toContain("Max-Age=0");
  });
});
