import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { siteCopy } from "@/shared/copy";
import { LandingRoute } from "@/frontend/routes/LandingRoute";

/**
 * 落地页。
 *
 * - 口号在铭牌下面、`h1` 上面。
 * - `h1` 按宽度换行，不靠硬换行；提交按钮是最小宽度，不是固定宽度。
 * - 灵龛阵列的卡片上带一个紧凑的充能等级标记。
 */
describe("LandingRoute", () => {
  it("口号出现在铭牌下面、h1 上面", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LandingRoute />
      </MemoryRouter>,
    );

    /* 显式指定语言：测试环境把当前语言钉在 `zh-Hans`，断言的是中文原句。 */
    const slogan = screen.getByText(siteCopy("zh-Hans").slogan);
    const heading = screen.getByRole("heading", { level: 1 });

    expect(slogan).toBeInTheDocument();
    expect(heading).toHaveTextContent("看看你的仓库里哪些还在沉睡。");
    /* h1 里没有硬换行 —— 换行交给宽度决定。 */
    expect(heading.innerHTML).not.toContain("<br");

    const sloganTop = slogan.compareDocumentPosition(heading);
    expect(sloganTop & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("提交按钮是最小宽度 —— 标签变长时按钮跟着长", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LandingRoute />
      </MemoryRouter>,
    );
    const submit = screen.getByRole("button", { name: "开始鉴定" });
    expect(submit.className).toContain("sm:min-w-40");
    expect(submit.className).not.toContain("sm:w-40");
  });

  it("灵龛阵列的卡片上带充能等级标记", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <LandingRoute />
      </MemoryRouter>,
    );
    /* 假数据里 nadia / kenji / rune 分别落在 Ⅲ / Ⅱ / Ⅰ 阶 */
    expect(screen.getByText("Ⅲ")).toBeInTheDocument();
    expect(screen.getByText("Ⅱ")).toBeInTheDocument();
    expect(screen.getByText("Ⅰ")).toBeInTheDocument();
    /* 每张卡片上的标记都带一个可及名称 —— 不是裸 span 上的 aria-label。 */
    expect(screen.getByText("灵龛充能等级 Ⅲ 阶")).toBeInTheDocument();
    expect(screen.getByText("灵龛充能等级 Ⅱ 阶")).toBeInTheDocument();
    expect(screen.getByText("灵龛充能等级 Ⅰ 阶")).toBeInTheDocument();
  });
});
