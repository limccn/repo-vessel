import type { ReactNode } from "react";

export interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右侧动作区。 */
  actions?: ReactNode;
  /** 标题 id，供面板的 aria-labelledby 使用。 */
  id?: string;
  className?: string;
}

/**
 * 面板抬头。标题用展示字体，副标题用弱化色。
 *
 * 标题与副标题**不截断** —— 它们是文案，不是数据。宁可让它换行把面板撑高，
 * 也不要切掉半句话。截断只留给仓库描述与等宽标识符。
 */
export function PanelHeader({ title, subtitle, actions, id, className }: PanelHeaderProps) {
  return (
    <header
      className={
        className ??
        "flex items-end justify-between gap-4 border-b border-hairline-soft px-6 py-4"
      }
    >
      <div className="min-w-0">
        <h2 id={id} className="display-cn text-lg text-fg-primary">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-xs text-fg-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </header>
  );
}
