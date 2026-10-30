import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

/**
 * 站点地址的构建时缺省值。
 *
 * `index.html` 的 `og:image` / `twitter:image` / `og:url` 必须是**绝对** URL ——
 * Open Graph 不接受相对路径，抓取方拿到 `/icon.jpg` 只会显示一张空白卡片。
 * 所以这三个值在构建时定死，走 `VITE_SITE_URL`；`src/frontend/lib/env.ts` 里
 * 的 `SITE_URL` 是另一回事，它取运行时的 `location.origin`，用于分享文案里的
 * 页面链接（同一份构建部署到预览域名时，分享出去的应该是用户当时看的那一个）。
 */
const DEFAULT_SITE_URL = "https://repovessel.lmlh.net";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = (env.VITE_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "inject-site-url",
        // `%SITE_URL%` 一定被替换：没有配置值时回落到 DEFAULT_SITE_URL，
        // 不会把占位符漏进产物。
        transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", siteUrl),
      },
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      outDir: "dist",
      // The SPA fallback is handled by Cloudflare (`not_found_handling: "single-page-application"`),
      // so the build only needs to emit static assets.
      emptyOutDir: true,
    },
    server: {
      port: 5173,
    },
  };
});
