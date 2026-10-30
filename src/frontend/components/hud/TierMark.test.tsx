import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TIER_LABELS, TIER_ORDER } from "@/shared/ids";
import { setActiveLocale } from "@/shared/i18n";
import { TierMark } from "@/frontend/components/hud/TierMark";

/**
 * 灵龛充能等级标记。
 *
 * 三件事必须永远成立：
 * - 罗马数字与「阶」永远可见 —— 等级不由颜色单独承担。
 * - 星标数量与档位对得上 —— 量级是冗余的第二个信号。
 * - 含义由**视觉隐藏的真实文本**承载，而不是裸 `<span>` 上的 `aria-label`
 *   （裸 span 的 role 是 `generic`，很多读屏直接丢掉它的可及名称）。
 */
describe("TierMark", () => {
  it("罗马数字与阶永远可见", () => {
    render(<TierMark tier="iii" />);
    expect(screen.getByText("Ⅲ")).toBeInTheDocument();
    expect(screen.getByText("阶")).toBeInTheDocument();
  });

  it("未启封没有数字，也没有星标", () => {
    const { container } = render(<TierMark tier="unsealed" />);
    expect(screen.getByText("未启封")).toBeInTheDocument();
    expect(container.textContent).not.toContain("★");
  });

  it("星标数量与档位对得上", () => {
    for (const tier of TIER_ORDER) {
      const { container, unmount } = render(<TierMark tier={tier} />);
      const stars = container.textContent?.match(/★/g) ?? [];
      expect(stars.length).toBe(TIER_LABELS[tier].stars);
      unmount();
    }
  });

  it("可及名称由视觉隐藏的真实文本承载，而不是 aria-label", () => {
    render(<TierMark tier="ii" />);
    expect(screen.getByText("灵龛充能等级 Ⅱ 阶")).toBeInTheDocument();
    expect(screen.queryByLabelText("灵龛充能等级 Ⅱ 阶")).not.toBeInTheDocument();
  });

  it("等级词里没有金 / 银 / 铜", () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_LABELS[tier].label).not.toMatch(/[金银铜]/);
      expect(TIER_LABELS[tier].description).not.toMatch(/[金银铜]/);
    }
  });

  it("语言切换后等级词与可及名称一起换，数字与星标不动", () => {
    setActiveLocale("en");
    const { container } = render(<TierMark tier="iii" />);
    expect(screen.getByText("Ⅲ")).toBeInTheDocument();
    expect(screen.getByText("Tier")).toBeInTheDocument();
    expect(screen.getByText("Vessel Charge Tier Ⅲ")).toBeInTheDocument();
    expect(container.textContent?.match(/★/g)?.length).toBe(3);
  });

  it("词序跟着语言走 —— 英语是「Tier Ⅲ」，不是「Ⅲ Tier」", () => {
    setActiveLocale("en");
    render(<TierMark tier="iii" />);

    /* `gap-1` 负责两段之间的空档，所以这里是两个并列的 span：
       数字在前还是词在前，由译文决定，不由组件写死。 */
    const word = screen.getByText("Tier");
    const numeral = screen.getByText("Ⅲ");
    expect(
      word.compareDocumentPosition(numeral) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
