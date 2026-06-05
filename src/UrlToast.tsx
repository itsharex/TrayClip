import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Link } from "lucide-react";
import { useTranslation } from "./lib/i18n";
import { Button } from "@/components/ui/button";

export default function UrlToast() {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("trayclip-theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    const style = document.createElement("style");
    style.textContent = "html,body,#root{margin:0;padding:0;height:100%;background:transparent}";
    document.head.appendChild(style);
    let unlistenTheme: (() => void) | undefined;
    listen<string>("theme://changed", (e) => {
      document.documentElement.setAttribute("data-theme", e.payload);
    }).then((fn) => { unlistenTheme = fn; });
    return () => {
      unlistenTheme?.();
      style.remove();
    };
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
    <div className="flex h-full items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-0 shadow-md">
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
        <Link className="h-3 w-3" />
      </div>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground" title={url}>
        {display}
      </span>
      <Button size="sm" className="h-6 flex-shrink-0 px-2 text-[11px]" onClick={() => void handleOpen()}>
        {t.openLink}
      </Button>
    </div>
  );
}
