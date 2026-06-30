import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { I18nProvider } from "./lib/i18n";
import App from "./App";
import UrlToast from "./UrlToast";
import "./index.css";

const label = getCurrentWindow().label;

// Add platform class for macOS-specific styling (e.g. window border-radius)
if (/Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent)) {
    document.documentElement.classList.add("is-mac");
}

document.addEventListener("contextmenu", (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) {
        e.preventDefault();
    }
});

const Root = label === "url-toast" ? <UrlToast /> : <App />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <I18nProvider>
        {Root}
    </I18nProvider>,
);
