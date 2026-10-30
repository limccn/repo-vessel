import { Fragment, type ReactNode } from "react";

/**
 * 整句翻译里的行内标记。
 *
 * 一段话里既有加粗又有一个组件（主题列表、下架链接）时，**不能**把句子拆成
 * 几个 msgid —— 拆开之后每种语言都得按中文的语序重新拼，翻译就没法自然。
 * 所以整句是一条 msgid，里面留两类占位：
 *
 * - `**加粗**` —— 渲染成 `<strong>`，语序随译文走。
 * - `{name}` —— 由 `nodes` 换成真实节点（链接、主题列表）。
 *
 * 没有对应节点的 `{name}` 原样保留 —— 看得见的占位符好过一个悄悄消失的词。
 * 不提供 `nodes` 时，这个组件就是「带加粗的普通文本」。
 */
export interface TransProps {
  text: string;
  nodes?: Record<string, ReactNode>;
}

const TOKEN = /(\*\*[^*]+\*\*|\{\w+\})/g;

export function Trans({ text, nodes }: TransProps) {
  return (
    <>
      {text.split(TOKEN).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        const placeholder = /^\{(\w+)\}$/.exec(part);
        if (placeholder) {
          const name = placeholder[1] ?? "";
          return <Fragment key={index}>{nodes?.[name] ?? part}</Fragment>;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
