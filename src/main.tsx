import ReactDOM from "react-dom/client";
import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { I18nProvider } from "./lib/i18n";
import App from "./App";
import QuickPanel from "./QuickPanel";
import "./styles.css";

const label = getCurrentWindow().label;

document.addEventListener("contextmenu", (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) {
        e.preventDefault();
    }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <I18nProvider>
            {label === "quick-panel" ? <QuickPanel /> : <App />}
        </I18nProvider>
    </React.StrictMode>,
);
