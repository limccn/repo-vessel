import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/frontend/App";
import { LocaleProvider } from "@/frontend/i18n/LocaleProvider";
import "@/frontend/styles/index.css";

/* `index.html` 里的 `<title>` / `<html lang>` 是水合之前的默认值；运行时的
   那一份由 `LocaleProvider` 按当前语言写入，所以换语言不需要改 HTML。 */
const container = document.getElementById("root");
if (!container) {
  throw new Error("码之灵龛：找不到 #root 挂载点。");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
);
