import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      ".trellis/**",
      ".claude/**",
      "research/**",
      "scripts/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // 组件里不许出现裸 hex —— 颜色只能来自令牌文件。
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            "组件里不许出现裸 hex 颜色。颜色只能来自 src/frontend/styles/tokens.css。",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    // 生成物：`npm run tokens` 从 tokens.css 抄出来的只读镜像。它当然全是 hex ——
    // 那正是它存在的理由（SVG 与 Worker 读不到 CSS 变量）。真正的手写源头仍然
    // 只有 tokens.css，而 `npm run audit:design` 的 D1 规则会在两者不一致时失败。
    files: ["src/shared/tokens.generated.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
