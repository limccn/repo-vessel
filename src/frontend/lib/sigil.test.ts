import { describe, expect, it } from "vitest";
import { sigilFor } from "@/frontend/lib/sigil";

describe("sigilFor", () => {
  it("同一个仓库永远得到同一个纹章", () => {
    const a = sigilFor("alice/time-capsule-lab");
    const b = sigilFor("alice/time-capsule-lab");
    expect(a).toEqual(b);
  });

  it("不同仓库通常得到不同纹章", () => {
    const names = [
      "alice/time-capsule-lab",
      "bob/quiet-thing",
      "carol/deep-service",
      "dave/fork-of-x",
    ];
    const sigils = names.map(sigilFor);
    const keys = new Set(sigils.map((s) => `${s.glyph}-${s.hue}-${s.rotation}`));
    expect(keys.size).toBe(names.length);
  });

  it("旋转角度是 15 度的整数倍", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(sigilFor(`repo-${i}`).rotation % 15).toBe(0);
    }
  });
});
