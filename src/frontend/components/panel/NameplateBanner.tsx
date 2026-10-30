import type { ReactNode } from "react";
import { cx } from "@/frontend/lib/cx";

export interface NameplateBannerProps {
  children: ReactNode;
  /** 斜切量。默认 12px。 */
  skew?: number;
  /** 铭牌上的装饰符号，比如一柄小剑、一枚星。 */
  mark?: ReactNode;
  className?: string;
  /**
   * 标题层级。铭牌在页面标题的位置上时传 1 —— 「每页一个 h1」是硬规则
   * （交互规范 §8.1、视觉系统 §10）。不传就渲染成普通的 span。
   *
   * 传 1 时自动带上 `tabindex="-1"`：路由切换后焦点要落到页面标题上
   * （交互规范 §8.3）。
   */
  headingLevel?: 1 | 2 | 3;
}

/**
 * 称号铭牌 —— 斜切的横幅，Dota 里用来压住角色名字的那一条。
 *
 * 中文标题靠字距承担「宽字距」的观感，不用 text-transform：汉字没有大写。
 */
export function NameplateBanner({
  children,
  skew = 12,
  mark,
  className,
  headingLevel,
}: NameplateBannerProps) {
  const Tag = headingLevel ? (`h${headingLevel}` as "h1" | "h2" | "h3") : "span";
  return (
    <div
      className={cx("nameplate", className)}
      style={{ "--np-skew": `${skew}px` } as React.CSSProperties}
    >
      {mark ? (
        <span aria-hidden="true" className="text-gold">
          {mark}
        </span>
      ) : null}
      <Tag
        tabIndex={headingLevel === 1 ? -1 : undefined}
        className="display-cn text-sm text-fg-primary"
      >
        {children}
      </Tag>
    </div>
  );
}
