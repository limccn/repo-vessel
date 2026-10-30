import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Envelope, InspectPayload } from "@/shared/contract";
import { setActiveLocale } from "@/shared/i18n";
import { DashboardLayout } from "@/frontend/layouts/DashboardLayout";
import { rarityMeterVars } from "@/frontend/lib/rarity";
import { mockInspect } from "@/frontend/mock/fixtures";

/**
 * 英雄面板上的「灵龛充能等级」块。
 *
 * 三条不变式：
 * - 数量未知 → 等级未知（`? 未知`），**不画条**，也绝不说成「未启封」。
 * - 任何 Ⅰ 阶及以上的档位都有一条不为空的条。
 * - Ⅳ 阶没有下一档 → 读作「充能完毕」，不是一条满格。
 */
function tierBlock(container: HTMLElement): HTMLElement {
  const block = container.querySelector('section[aria-label="灵龛充能等级"]');
  expect(block).not.toBeNull();
  return block as HTMLElement;
}

function withEnrolled(
  envelope: Envelope<InspectPayload>,
  enrolledCount: number | null,
): Envelope<InspectPayload> {
  return { ...envelope, data: { ...envelope.data!, enrolledCount } };
}

describe("DashboardLayout 的充能等级块", () => {
  it("数量已知 → 等级、条与剩余数量都在", () => {
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), 7)} />,
    );
    const block = tierBlock(container);

    expect(block.textContent).toContain("Ⅱ");
    expect(block.textContent).toContain("再收 3 个仓库升到 Ⅲ 阶。");
    expect(block.querySelector(".meter")).not.toBeNull();

    const fill = block.querySelector(".meter__fill") as HTMLElement;
    /* 条量的是当前档的顶：(7 - 5 + 1) / 5 = 60% */
    expect(fill.style.width).toBe("60%");
  });

  it("等级块在称号卡与统计格之间（交互规范 §3 M2.2 #14、视觉系统 §8.1）", () => {
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), 7)} />,
    );
    const block = tierBlock(container);
    const stats = container.querySelector("dl");
    expect(stats).not.toBeNull();

    /* 位置是文档写死的视觉位置：等级块在统计格之前，不是在它下面。 */
    expect(
      block.compareDocumentPosition(stats as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("充能条不等于任何一条稀有度渐变（两根轴不共用颜色）", () => {
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), 7)} />,
    );
    const meter = tierBlock(container).querySelector(".meter") as HTMLElement;
    const fill = meter.querySelector(".meter__fill") as HTMLElement;

    /* 渐变的两端挂在计量条容器上（`.meter`），填充块只带宽度。 */
    const from = meter.style.getPropertyValue("--meter-from").trim();
    const to = meter.style.getPropertyValue("--meter-to").trim();
    expect(from).not.toBe("");
    expect(to).not.toBe("");
    expect(fill.style.width).not.toBe("");

    /* 稀有度有四条渐变，充能条一条都不能撞上 —— 同一个金色不能同时说
       「这个仓库沉了三年」和「这个人攒了 7 个仓库」（视觉系统 §4.4）。 */
    for (const rarity of ["legendary", "epic", "rare", "common"] as const) {
      const vars = rarityMeterVars(rarity);
      expect(from === vars.from && to === vars.to).toBe(false);
    }
  });

  it("数量未知 → ? 未知，没有条，绝不是「未启封」", () => {
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), null)} />,
    );
    const block = tierBlock(container);

    expect(block.textContent).toContain("? 未知");
    expect(block.querySelector(".meter")).toBeNull();
    expect(block.textContent).not.toContain("未启封");
    expect(block.textContent).not.toContain("再收");
  });

  it("Ⅳ 阶没有下一档 —— 读作「充能完毕」，不是一条满格", () => {
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), 30)} />,
    );
    const block = tierBlock(container);

    expect(block.textContent).toContain("充能完毕");
    expect(block.querySelector(".meter")).toBeNull();
    expect(block.textContent).not.toContain("再收");
  });

  it("未启封 —— 有说明，没有条", () => {
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), 0)} />,
    );
    const block = tierBlock(container);

    expect(block.textContent).toContain("未启封");
    expect(block.querySelector(".meter")).toBeNull();
    expect(block.textContent).toContain("再收 1 个仓库升到 Ⅰ 阶。");
  });
});

/**
 * 换语言是**整页**的事：等级块的标题、剩余数量、统计行与陈旧说明都得跟着走。
 * 测试环境把模块级语言钉在 `zh-Hans`（`src/frontend/test/setup.ts`），所以这里
 * 在用例内部显式改成英语 —— `useI18n()` 没有 Provider 时读的就是这个值。
 */
describe("DashboardLayout 的语言切换", () => {
  it("英语界面：等级块与统计行都取英语文案", () => {
    setActiveLocale("en");
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), 7)} />,
    );

    const block = container.querySelector('section[aria-label="Vessel Charge"]');
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain("Gather 3 more to reach Tier Ⅲ.");
    expect(container.textContent).toContain("Longest slumber");
    expect(container.textContent).toContain("Public forks");
    expect(container.textContent).toContain("View my repositories");
    /* 中文原句不该漏进英语界面。 */
    expect(container.textContent).not.toContain("再收");
  });

  it("英语界面：数量未知仍然说「没读到」，不是 Unsealed", () => {
    setActiveLocale("en");
    const { container } = render(
      <DashboardLayout envelope={withEnrolled(mockInspect("alice"), null)} />,
    );

    const block = container.querySelector('section[aria-label="Vessel Charge"]');
    expect(block?.textContent).toContain("could not be read this time");
    expect(block?.textContent).not.toContain("Unsealed");
    expect(block?.textContent).not.toContain("未启封");
    expect(block?.textContent).not.toContain("再收");
  });

  it("英语界面：陈旧时长用英语单位，不是中文「天」", () => {
    setActiveLocale("en");
    const stale: Envelope<InspectPayload> = {
      ...mockInspect("alice"),
      /* 2.4 天 → 向上取整 3 天；超过 24 小时才算陈旧。 */
      readAt: new Date(Date.now() - 2.4 * 24 * 3_600_000).toISOString(),
    };
    const { container } = render(<DashboardLayout envelope={stale} />);

    expect(container.textContent).toContain("This data is 3 days old.");
    expect(container.textContent).not.toContain("天前的数据");
  });
});
