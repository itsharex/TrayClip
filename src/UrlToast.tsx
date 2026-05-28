import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "./lib/i18n";

export default function UrlToast() {
    const { t } = useTranslation();
    const [url, setUrl] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("trayclip-theme") || "light";
        document.documentElement.setAttribute("data-theme", saved);
        const style = document.createElement("style");
        style.textContent = "html,body,#root{margin:0;padding:0;height:100%;background:transparent}";
        document.head.appendChild(style);
        const unlistenTheme = listen<string>("theme://changed", (e) => {
            document.documentElement.setAttribute("data-theme", e.payload);
        });
        return () => { unlistenTheme.then((fn) => fn()); };
    }, []);

    useEffect(() => {
        const unlisten = listen<string>("url-toast://show", (event) => {
            setUrl(event.payload);
        });
        return () => { unlisten.then((fn) => fn()); };
    }, []);

    const dismiss = useCallback(async () => {
        setUrl("");
        await getCurrentWindow().hide();
    }, []);

    const handleOpen = useCallback(async () => {
        if (url) {
            try { await openUrl(url); } catch (e) { console.error("Failed to open URL:", e); }
        }
        await dismiss();
    }, [url, dismiss]);

    if (!url) return null;

    const display = url.replace(/^https?:\/\//, "");

    return (
        <div className="url-toast">
            <div className="url-toast__icon-wrap">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
            </div>
            <span className="url-toast__url" title={url}>{display}</span>
            <button className="url-toast__open" onClick={handleOpen}>{t.openLink}</button>
        </div>
    );
}
