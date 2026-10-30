/**
 * Wrangler 的 `rules` 会把资源文件变成模块：`.wasm` → `WebAssembly.Module`
 * （`CompiledWasm`），`.ttf` → `ArrayBuffer`（`Data`）。这两条声明让 TypeScript
 * 认识它们；规则本身写在 `wrangler.jsonc`，缺一条部署就会失败 —— 而这里是
 * 唯一会用到这两种规则的地方。
 */

declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}
