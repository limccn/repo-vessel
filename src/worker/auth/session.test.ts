// @vitest-environment node
/**
 * 会话令牌的签发与验证。
 *
 * 用 node 环境跑：jsdom 没有实现 `crypto.subtle`，而这套签名完全建立在它上面。
 */
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  createSessionPayload,
  signSession,
  verifySession,
  withLocale,
} from "./session";

const SECRET = "test-secret-do-not-use-anywhere-else";
const USER = { id: 42, login: "alice" };

describe("signSession / verifySession", () => {
  it("签了再验，拿回原来的载荷", async () => {
    const payload = createSessionPayload(USER, 1_000);
    const token = await signSession(payload, SECRET);

    expect(token.startsWith("v1.")).toBe(true);
    await expect(verifySession(token, SECRET, 1_001)).resolves.toEqual(payload);
  });

  it("载荷里只有身份与时间，没有 access token", async () => {
    const token = await signSession(createSessionPayload(USER, 1_000), SECRET);
    const body = token.split(".")[1]!;
    const decoded = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual(["exp", "iat", "login", "sub"]);
  });

  it("改了载荷，签名就对不上", async () => {
    const token = await signSession(createSessionPayload(USER, 1_000), SECRET);
    const [version, body, signature] = token.split(".") as [string, string, string];

    const forged = Buffer.from(JSON.stringify({ ...createSessionPayload(USER, 1_000), login: "mallory" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await expect(
      verifySession(`${version}.${forged}.${signature}`, SECRET, 1_001),
    ).resolves.toBeNull();
    expect(body).not.toBe(forged);
  });

  it("换一把密钥就验不过", async () => {
    const token = await signSession(createSessionPayload(USER, 1_000), SECRET);
    await expect(verifySession(token, "another-secret", 1_001)).resolves.toBeNull();
  });

  it("过期之后不再有效", async () => {
    const payload = createSessionPayload(USER, 1_000);
    const token = await signSession(payload, SECRET);

    await expect(
      verifySession(token, SECRET, 1_000 + SESSION_TTL_SECONDS - 1),
    ).resolves.toEqual(payload);
    await expect(
      verifySession(token, SECRET, 1_000 + SESSION_TTL_SECONDS),
    ).resolves.toBeNull();
  });

  it("结构不对的一律拒绝", async () => {
    await expect(verifySession("", SECRET)).resolves.toBeNull();
    await expect(verifySession("garbage", SECRET)).resolves.toBeNull();
    await expect(verifySession("v2.a.b", SECRET)).resolves.toBeNull();
    await expect(verifySession(null, SECRET)).resolves.toBeNull();
  });
});

describe("语言偏好", () => {
  it("偏好跟着会话走：签进去、验出来", async () => {
    const payload = createSessionPayload(USER, 1_000, "ja");
    const token = await signSession(payload, SECRET);

    const verified = await verifySession(token, SECRET, 1_001);
    expect(verified?.lang).toBe("ja");
  });

  it("换偏好不动身份，也不顺手续期", () => {
    const payload = createSessionPayload(USER, 1_000, "en");
    const next = withLocale(payload, "zh");

    expect(next).toEqual({ ...payload, lang: "zh" });
    expect(next.exp).toBe(payload.exp);
    expect(next.iat).toBe(payload.iat);
  });

  it("`null` 清掉偏好 —— 回到跟随浏览器", () => {
    const next = withLocale(createSessionPayload(USER, 1_000, "ja"), null);
    expect(next).toEqual(createSessionPayload(USER, 1_000));
    expect("lang" in next).toBe(false);
  });

  it("认不出的偏好被丢掉，但会话仍然有效", async () => {
    /* 未来版本可能写进来别的值。签名是对的，所以这不是伪造；
       丢掉那个字段即可，不该把人登出。 */
    const payload = { ...createSessionPayload(USER, 1_000), lang: "fr" as never };
    const token = await signSession(payload, SECRET);

    const verified = await verifySession(token, SECRET, 1_001);
    expect(verified).not.toBeNull();
    expect(verified?.login).toBe("alice");
    expect(verified?.lang).toBeUndefined();
  });
});
