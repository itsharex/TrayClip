import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getBootstrap, hideQuickPanel, setDragging, pinToggle, recopyClip, moveClipToGroup, deleteClip } from "./lib/api";
import type { BootstrapPayload } from "./lib/types";
import { useTranslation } from "./lib/i18n";
import { HistoryList } from "./components/HistoryList";

const fallback: BootstrapPayload = {
  clips: { items: [], total: 0, has_more: false },
  groups: [],
  settings: {
    retention_limit: 200,
    launch_on_startup: false,
    pause_capture: false,
    locale: "zh-CN",
    accessibility_prompted: false,
    close_behavior: "hide",
    panel_position: "center",
  },
  hotkeys: [],
  permissions: {
    accessibility_granted: false,
    accessibility_required_for_paste: true,
  },
};

export default function QuickPanel() {
  const { t } = useTranslation();
  const [state, setState] = useState<BootstrapPayload>(fallback);
  const [search, setSearch] = useState("");
  const [autoSelect, setAutoSelect] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [search]);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => { setNotice(null); noticeTimerRef.current = null; }, 1500);
  }, []);

  const load = useCallback(async () => {
    const payload = await getBootstrap();
    setState(payload);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const saved = localStorage.getItem("trayclip-theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    let unlistenClips: (() => void) | undefined;
    let unlistenFocus: (() => void) | undefined;
    let unlistenTheme: (() => void) | undefined;

    void listen("clips://updated", () => { void load(); }).then((fn) => { unlistenClips = fn; });
    void listen("focus-quick-search", () => {
      setSearch("");
      setAutoSelect(true);
      scrollRef.current?.scrollTo(0, 0);
    }).then((fn) => { unlistenFocus = fn; });
    void listen<string>("theme://changed", (e) => {
      document.documentElement.setAttribute("data-theme", e.payload);
    }).then((fn) => { unlistenTheme = fn; });

    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      unlistenClips?.();
      unlistenFocus?.();
      unlistenTheme?.();
    };
  }, [load]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void hideQuickPanel();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const filteredClips = useMemo(() => {
    return state.clips.items.filter((clip) => {
      return `${clip.summary} ${clip.plain_text ?? ""} ${clip.source_app} ${clip.file_paths.join(" ")}`.toLowerCase().includes(search.toLowerCase());
    });
  }, [search, state.clips.items]);

  const handleRecopy = useCallback(async (clipId: number) => {
    await recopyClip(clipId);
    void hideQuickPanel();
  }, []);

  return (
    <main className="quick-panel">
      <div className="quick-panel__drag-handle" onMouseDown={(e) => {
        if (e.button === 0) {
          void setDragging(true);
          getCurrentWindow().startDragging();
          setTimeout(() => void setDragging(false), 500);
        }
      }}>
        <span className="quick-panel__brand">{t.brand}</span>
      </div>
      <div className="quick-panel__header">
        <input
          ref={searchInputRef}
          className="quick-panel__search"
          placeholder={t.quickPanelSearch}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      <div className="quick-panel__list" ref={scrollRef}>
        <HistoryList
          clips={filteredClips}
          groups={state.groups}
          autoSelect={autoSelect}
          onAutoSelectDone={() => setAutoSelect(false)}
          onRecopy={handleRecopy}
          onPinToggle={async (clipId, pinned) => { await pinToggle(clipId, pinned); await load(); }}
          onMoveGroup={async (clipId, groupId) => { await moveClipToGroup(clipId, groupId); await load(); }}
          onDelete={async (clipId) => { await deleteClip(clipId); await load(); }}
        />
      </div>
      {notice ? <div className="toast">{notice}</div> : null}
    </main>
  );
}
