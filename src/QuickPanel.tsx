import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  getBootstrap,
  hideQuickPanel,
  listClips,
  setDragging,
  pinToggle,
  recopyClip,
  moveClipToGroup,
  deleteClip,
} from "./lib/api";
import { FALLBACK_BOOTSTRAP } from "./lib/constants";
import type { AppSettings, BootstrapPayload } from "./lib/types";
import { useTranslation } from "./lib/i18n";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ClipList } from "@/components/ClipList";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ConfirmDialog";


export default function QuickPanel() {
  const { t } = useTranslation();
  const [state, setState] = useState<BootstrapPayload>(FALLBACK_BOOTSTRAP);
  const [search, setSearch] = useState("");
  const [autoSelect, setAutoSelect] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { confirm, setConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [search]);

  const loadClips = useCallback(async () => {
    try {
      const clips = await listClips({ page: 1, page_size: 100 });
      setState((prev) => ({ ...prev, clips }));
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async () => {
    const payload = await getBootstrap();
    setState(payload);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) void loadClips();
    }).then((fn) => {
      if (cancelled) { fn(); return; }
      unlisten = fn;
    });
    return () => { cancelled = true; unlisten?.(); };
  }, [load]);

  useEffect(() => {
    const saved = localStorage.getItem("trayclip-theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  useEffect(() => {
    const unlistens: (() => void)[] = [];
    let cancelled = false;
    const register = (fn: () => void) => { if (cancelled) { fn(); return; } unlistens.push(fn); };

    void listen("clips://updated", () => { void loadClips(); }).then(register);
    void listen("focus-quick-search", () => {
      setSearch("");
      setAutoSelect(true);
      scrollRef.current?.scrollTo(0, 0);
    }).then(register);
    void listen<string>("theme://changed", (e) => {
      document.documentElement.setAttribute("data-theme", e.payload);
    }).then(register);
    void listen<AppSettings>("settings://changed", (e) => {
      setState((current) => ({ ...current, settings: e.payload }));
    }).then(register);

    return () => {
      cancelled = true;
      unlistens.forEach((fn) => fn());
    };
  }, [load]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (confirm) { setConfirm(null); }
        else { void hideQuickPanel(); }
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [confirm]);

  const filteredClips = useMemo(() => {
    return state.clips.items.filter((clip) => {
      return `${clip.summary} ${clip.plain_text ?? ""} ${clip.source_app} ${clip.file_paths.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase());
    });
  }, [search, state.clips.items]);

  const handleRecopy = useCallback(async (clipId: number) => {
    await recopyClip(clipId);
    await hideQuickPanel(state.settings.quick_paste);
  }, [state.settings.quick_paste]);

  const handlePinToggle = useCallback((clipId: number, pinned: boolean) => {
    void pinToggle(clipId, pinned).then(() => loadClips());
  }, [loadClips]);

  const handleMoveGroup = useCallback((clipId: number, groupId: number | null) => {
    void moveClipToGroup(clipId, groupId).then(() => loadClips());
  }, [loadClips]);

  const handleDeleteClip = useCallback((clipId: number) => {
    setConfirm({
      message: t.confirmDeleteClip,
      onConfirm: async () => { await deleteClip(clipId); await loadClips(); },
    });
  }, [loadClips, t]);

  return (
    <main className="flex h-screen flex-col overflow-hidden rounded-xl border border-border/50 bg-background text-foreground shadow-xl">
      {/* Brand drag handle */}
      <div
        className="flex h-7 flex-shrink-0 cursor-grab items-center justify-center border-b border-border/50 bg-muted active:cursor-grabbing"
        onMouseDown={(e) => {
          if (e.button === 0) {
            void setDragging(true);
            getCurrentWindow().startDragging();
            setTimeout(() => void setDragging(false), 500);
          }
        }}
      >
        <span className="select-none text-xs font-semibold tracking-wide text-primary">{t.brand}</span>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 border-b border-border/50 bg-muted px-2.5 py-1.5">
        <Input
          ref={searchInputRef}
          placeholder={t.quickPanelSearch}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="h-7 rounded-lg border border-border/60 bg-card text-xs placeholder:text-muted-foreground/50 focus-visible:border-primary/30 dark:bg-card"
        />
      </div>

      {/* Clip list — full ClipCard with actions */}
      <ClipList
        clips={filteredClips}
        groups={state.groups}
        settings={state.settings}
        scrollRef={scrollRef}
        onRecopy={handleRecopy}
        onPinToggle={handlePinToggle}
        onMoveGroup={handleMoveGroup}
        onDelete={handleDeleteClip}
      />

      {/* Confirm Dialog */}
      {confirm ? (
        <ConfirmDialog
          open
          message={confirm.message}
          variant="destructive"
          onConfirm={() => void handleConfirm()}
          onCancel={() => void handleCancel()}
        />
      ) : null}

    </main>
  );
}
