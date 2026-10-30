/**
 * `HTMLRewriter` 的最小声明。项目没有装 `@cloudflare/workers-types`，而
 * `src/worker/env.ts` 的约定是「只声明真正用到的那几个成员」—— 这里只写
 * `element.setAttribute` 一个方法，因为 `/u/*` 的改写只做这件事。
 */

interface HTMLRewriterElement {
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  remove(): void;
  after(content: string, options?: { html: boolean }): void;
}

interface HTMLRewriterHandlers {
  element?(element: HTMLRewriterElement): void;
  text?(text: { text: string; lastInTextNode: boolean }): void;
}

interface HTMLRewriterLike {
  on(selector: string, handlers: HTMLRewriterHandlers): HTMLRewriterLike;
  transform(response: Response): Response;
}

declare const HTMLRewriter: {
  new (): HTMLRewriterLike;
};
