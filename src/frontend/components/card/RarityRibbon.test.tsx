import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RarityRibbon } from "@/frontend/components/card/RarityRibbon";

/**
 * 缎带是稀有度的唯一文字载体，所以等级词必须永远在。
 * 扫光只属于传说，而且扫光元素必须真的挂上 `.rarity-ribbon__sweep` ——
 * 那个类才有宽度、渐变与定位；挂错名字，扫光就成了一段看不见的动画。
 */
describe("RarityRibbon", () => {
  it("等级词永远渲染", () => {
    render(<RarityRibbon rarity="legendary" />);
    expect(screen.getByText("传说")).toBeInTheDocument();
  });

  it("传说带扫光，扫光元素挂着 .rarity-ribbon__sweep", () => {
    const { container } = render(<RarityRibbon rarity="legendary" />);
    const sweep = container.querySelector(".rarity-ribbon__sweep");
    expect(sweep).not.toBeNull();
    expect(sweep).toHaveClass("animate-ribbon-shimmer");
  });

  it("非传说没有扫光", () => {
    const { container } = render(<RarityRibbon rarity="epic" />);
    expect(container.querySelector(".rarity-ribbon__sweep")).toBeNull();
  });
});
