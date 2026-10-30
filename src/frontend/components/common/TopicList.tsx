import { Fragment } from "react";
import { REPO_TOPICS } from "@/frontend/lib/env";

/**
 * 主题列表 —— 把每一个主题渲染成独立的 `<code>`，中间用「或」连接。
 *
 * 主题是一组（默认 `repo-vessel` 与 `urn-of-repos`），所以不能只渲染第一个：
 * 用户照着页面上的字去 Settings → Topics 里填，填哪个都该有用。
 *
 * 样式交给外层容器（`HowRoute` 用 `[&_code]` 统一给等宽与高亮色），
 * 这个组件只管结构与连接词。
 */
export function TopicList() {
  return (
    <>
      {REPO_TOPICS.map((topic, index) => (
        <Fragment key={topic}>
          {index > 0 ? <span className="text-fg-muted"> 或 </span> : null}
          <code>{topic}</code>
        </Fragment>
      ))}
    </>
  );
}
