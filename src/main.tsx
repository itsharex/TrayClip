import ReactDOM from "react-dom/client";
import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { I18nProvider } from "./lib/i18n";
import App from "./App";
import QuickPanel from "./QuickPanel";
import "./styles.css";

const label = getCurrentWindow().label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      {label === "quick-panel" ? <QuickPanel /> : <App />}
    </I18nProvider>
  </React.StrictMode>,
);
