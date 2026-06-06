import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  backupData,
  checkUpdate,
  clearHistory,
  deleteClip,
  deleteGroup,
  getConfig,
  hideWindow,
  listClips,
  listGroups,
  moveClipToGroup,
  pinToggle,
  quitApp,
  recopyClip,
  restoreBackup,
  saveGroup,
  updateHotkey,
  updateSettings,
} from "@/lib/api";
import { FALLBACK_BOOTSTRAP } from "@/lib/constants";
import type { AppSettings, BootstrapPayload, ClipGroup, TabKey } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { WindowBar } from "@/components/WindowBar";
import { GroupBar } from "@/components/GroupBar";
import { ClipList } from "@/components/ClipList";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

const APP_VERSION = import.meta.env.TAURI_ENV_VERSION ?? "0.0.0";

function AboutPanel() {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    has_update: boolean;
    latest_version: string;
    download_url: string;
    body: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    setError(null);
    try {
      const runtimeVersion = await getVersion();
      const info = await checkUpdate(runtimeVersion, "exe");
      setResult(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-3">
        <Card className="border border-border/50 bg-card p-4">
          <div className="mb-3 flex justify-center">
            <img src="/logo.png" alt="TrayClip" width={64} height={64} className="rounded-xl" />
          </div>
          <h2 className="mb-1.5 text-sm font-semibold">{t.aboutTitle}</h2>
          <p className="mb-3 text-sm text-muted-foreground">{t.aboutDesc}</p>
          <ul className="space-y-1.5 text-[13px] text-muted-foreground">
            <li>{t.aboutVersion(APP_VERSION)}</li>
            <li>{t.aboutStorage}</li>
            <li>{t.aboutPlatform}</li>
            <li>{t.aboutLicense}</li>
            <li>
              Github:{" "}
              <a
                href="https://github.com/Heyiki/TrayClip"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                https://github.com/Heyiki/TrayClip
              </a>
            </li>
          </ul>
          <div className="mt-3">
            <button
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              onClick={() => void handleCheck()}
              disabled={checking}
            >
              {checking ? t.checking : t.checkUpdate}
            </button>
          </div>
          {result ? (
            <div className="mt-3">
              {result.has_update ? (
                <>
                  <p className="text-sm font-medium text-primary">{t.newVersion(result.latest_version)}</p>
                  {result.body ? (
                    <pre className="mt-1.5 max-h-[120px] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted p-2 text-xs text-muted-foreground">
                      {result.body}
                    </pre>
                  ) : null}
                  <a
                    href={result.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    {t.goToDownload}
                  </a>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">{t.upToDate}</p>
              )}
            </div>
          ) : null}
          {error ? <p className="mt-2 text-xs text-destructive">{t.checkFailed(error)}</p> : null}
        </Card>
      </div>
    </ScrollArea>
  );
}

export default function App() {
  const { t, locale, setLocale } = useTranslation();
  const [state, setState] = useState<BootstrapPayload>(FALLBACK_BOOTSTRAP);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(() => {
    const saved = localStorage.getItem("trayclip-selected-group");
    if (saved === null || saved === "null") return null;
    const n = Number(saved);
    return Number.isNaN(n) ? null : n;
  });
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("clips");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("trayclip-theme") as "light" | "dark") || "light";
  });
  const { confirm, setConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const scrollRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(state.settings);
  const selectedGroupIdRef = useRef(selectedGroupId);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const isDragging = useRef(false);
  const [loaded, setLoaded] = useState(false);

  const focusSearch = useCallback((selectText = false) => {
    setActiveTab("clips");
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      if (selectText) input.select();
    });
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await getConfig();
      setState((prev) => ({ ...prev, ...cfg }));
    } catch { /* ignore */ }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const groups = await listGroups();
      setState((prev) => ({ ...prev, groups }));
    } catch { /* ignore */ }
  }, []);

  const loadClips = useCallback(async (groupId?: number | null) => {
    try {
      const gid = groupId === undefined ? selectedGroupIdRef.current : groupId;
      const clips = await listClips({ page: 1, page_size: 100, group_id: gid ?? undefined });
      setState((prev) => ({ ...prev, clips }));
    } catch { /* ignore */ }
  }, []);

  // Alias for bulk refresh (startup, restore, clear history)
  const loadAll = useCallback(async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const [cfg, groups, clips] = await Promise.all([
          getConfig(),
          listGroups(),
          listClips({ page: 1, page_size: 100, group_id: selectedGroupIdRef.current ?? undefined }),
        ]);
        setState({ ...cfg, groups, clips });
        return;
      } catch {
        if (i < 2) await new Promise((r) => setTimeout(r, 100));
      }
    }
  }, []);

  // Startup: load everything, then show window
  useEffect(() => {
    void loadAll().finally(() => {
      initialLoadDone.current = true;
      setLoaded(true);
      const win = getCurrentWindow();
      void win.show();
      void win.setFocus();
    });
  }, [loadAll]);

  // Group switch: clear old clips immediately, then reload
  useEffect(() => {
    if (!initialLoadDone.current) return;
    setState((prev) => ({ ...prev, clips: { items: [], total: 0, has_more: false } }));
    void loadClips(selectedGroupId);
  }, [selectedGroupId, loadClips]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused && initialLoadDone.current && !isDragging.current) void loadClips();
    }).then((fn) => {
      if (cancelled) { fn(); return; }
      unlisten = fn;
    });
    return () => { cancelled = true; unlisten?.(); };
  }, [loadClips]);

  useEffect(() => { settingsRef.current = state.settings; }, [state.settings]);
  useEffect(() => {
    selectedGroupIdRef.current = selectedGroupId;
    localStorage.setItem("trayclip-selected-group", String(selectedGroupId));
  }, [selectedGroupId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("trayclip-theme", theme);
    void emit("theme://changed", theme);
  }, [theme]);

  useEffect(() => {
    const unlistens: (() => void)[] = [];
    let cancelled = false;
    const register = (fn: () => void) => { if (cancelled) { fn(); return; } unlistens.push(fn); };

    void listen("clips://updated", () => { void loadClips(); }).then(register);
    void listen("focus-main-search", () => {
      scrollRef.current?.scrollTo(0, 0);
      focusSearch(true);
    }).then(register);
    void listen("close-requested", () => {
      const behavior = settingsRef.current.close_behavior;
      if (behavior === "hide") {
        void hideWindow();
      } else if (behavior === "exit") {
        void quitApp();
      } else {
        setConfirm({
          message: t.confirmClose,
          confirmLabel: t.hideToTray,
          cancelLabel: t.exitApp,
          onConfirm: async () => { await hideWindow(); },
          onCancel: async () => { await quitApp(); },
        });
      }
    }).then(register);

    return () => {
      cancelled = true;
      unlistens.forEach((fn) => fn());
    };
  }, [focusSearch, t]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (confirm || activeTab !== "clips") return;
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const isSearchInput = target === searchInputRef.current;
      if (isEditable && !isSearchInput) return;
      event.preventDefault();
      if (search) { setSearch(""); focusSearch(false); return; }
      void hideWindow();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeTab, confirm, focusSearch, search]);

  useEffect(() => { document.querySelector("[data-radix-scroll-area-viewport]")?.scrollTo(0, 0); }, [search]);

  const filteredClips = useMemo(() => {
    if (!search) return state.clips.items;
    const q = search.toLowerCase();
    return state.clips.items.filter((clip) =>
      `${clip.summary} ${clip.plain_text ?? ""} ${clip.source_app} ${clip.file_paths.join(" ")}`
        .toLowerCase()
        .includes(q)
    );
  }, [search, state.clips.items]);
  const deferredClips = useDeferredValue(filteredClips);

  const saveSettings = useCallback(async (next: AppSettings) => {
    try {
      setState((current) => ({ ...current, settings: next }));
      const updated = await updateSettings(next);
      setState((current) => ({ ...current, settings: updated }));
      void emit("settings://changed", updated);
    } catch (e) {
      console.error("[TrayClip] saveSettings failed:", e);
    }
  }, []);

  const handleWindowClose = useCallback(async () => {
    const behavior = settingsRef.current.close_behavior;
    if (behavior === "hide") { await hideWindow(); return; }
    if (behavior === "exit") { await quitApp(); return; }
    setConfirm({
      message: t.confirmClose,
      confirmLabel: t.hideToTray,
      cancelLabel: t.exitApp,
      onConfirm: async () => { await hideWindow(); },
      onCancel: async () => { await quitApp(); },
    });
  }, [t]);

  const createGroup = useCallback(async (name: string) => {
    if (state.groups.some((g) => g.name === name)) return;
    await saveGroup(null, name);
    await loadGroups();
  }, [state.groups, loadGroups]);

  const renameGroup = useCallback(async (groupId: number, name: string) => {
    if (state.groups.some((g) => g.name === name && g.id !== groupId)) return;
    await saveGroup(groupId, name);
    await loadGroups();
  }, [state.groups, loadGroups]);

  const removeGroup = useCallback((group: ClipGroup) => {
    setConfirm({
      message: t.confirmDeleteGroup(group.name),
      variant: "destructive",
      onConfirm: async () => {
        await deleteGroup(group.id);
        if (selectedGroupId === group.id) setSelectedGroupId(null);
        await Promise.all([loadGroups(), loadClips()]);
      },
    });
  }, [selectedGroupId, loadGroups, loadClips, t]);

  const handleClearHistory = useCallback(() => {
    setConfirm({
      message: t.confirmClearHistory,
      variant: "destructive",
      onConfirm: async () => { await clearHistory(); await loadClips(); },
    });
  }, [loadClips, t]);

  const handleDeleteClip = useCallback((clipId: number) => {
    setConfirm({
      message: t.confirmDeleteClip,
      variant: "destructive",
      onConfirm: async () => { await deleteClip(clipId); await loadClips(); },
    });
  }, [loadClips, t]);

  const handleBackup = useCallback(async () => {
    const filePath = await save({
      filters: [{ name: "ZIP", extensions: ["zip"] }],
      defaultPath: `trayclip-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    });
    if (!filePath) return;
    await backupData(filePath);
  }, []);

  const handleRestore = useCallback(() => {
    setConfirm({
      message: t.confirmRestore,
      confirmLabel: t.restore,
      variant: "destructive",
      onConfirm: async () => {
        const filePath = await open({
          multiple: false,
          filters: [{ name: "TrayClip Backup", extensions: ["zip"] }],
        });
        if (!filePath) return;
        await restoreBackup(filePath as string);
        await loadAll();
      },
    });
  }, [t]);

  const handleRecopy = useCallback(async (clipId: number) => {
    await recopyClip(clipId);
    await loadClips();
  }, [loadClips]);

  const handlePinToggle = useCallback((clipId: number, pinned: boolean) => {
    void pinToggle(clipId, pinned).then(() => loadClips());
  }, [loadClips]);

  const handleMoveGroup = useCallback((clipId: number, groupId: number | null) => {
    void moveClipToGroup(clipId, groupId).then(() => loadClips());
  }, [loadClips]);

  return (
    <main className="flex h-screen flex-col overflow-hidden rounded-xl bg-background text-foreground">
      <WindowBar
        activeTab={activeTab}
        theme={theme}
        onTabChange={setActiveTab}
        onThemeToggle={() => setTheme((th) => (th === "light" ? "dark" : "light"))}
        onLanguageToggle={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
        onClose={() => void handleWindowClose()}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={() => { isDragging.current = false; }}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        {!loaded ? null : activeTab === "clips" ? (
          <>
            {/* Search + Groups */}
            <div className="flex-shrink-0 border-b border-border/50 bg-muted">
              <div className="px-3 py-1.5">
                <Input
                  ref={searchInputRef}
                  placeholder={t.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 rounded-lg border border-border/60 bg-card dark:bg-card text-xs placeholder:text-muted-foreground/50 focus-visible:border-primary/30"
                />
              </div>

              <GroupBar
                groups={state.groups}
                selectedGroupId={selectedGroupId}
                onSelect={setSelectedGroupId}
                onCreate={(name) => void createGroup(name)}
                onRename={(id, name) => void renameGroup(id, name)}
                onDelete={removeGroup}
              />

            {/* Record count */}
            <div className="flex-shrink-0 px-3 pb-1.5">
              <span className="text-[10px] text-muted-foreground/50">
                {t.recordsCount(state.clips.total)}
              </span>
            </div>
            </div>

            {/* Clip list */}
            <ClipList
              clips={deferredClips}
              groups={state.groups}
              settings={state.settings}
              scrollRef={scrollRef}
              onRecopy={handleRecopy}
              onPinToggle={handlePinToggle}
              onMoveGroup={handleMoveGroup}
              onDelete={handleDeleteClip}
            />
          </>
        ) : null}

        {loaded && activeTab === "settings" ? (
          <ScrollArea className="flex-1">
            <SettingsPanel
              settings={state.settings}
              hotkeys={state.hotkeys}
              onSettingsChange={saveSettings}
              onHotkeyChange={(actionKey, hotkeyValue) =>
                void updateHotkey(actionKey, hotkeyValue).then(() => loadConfig())
              }
              onBackup={() => void handleBackup()}
              onRestore={() => handleRestore()}
              onClearHistory={() => handleClearHistory()}
            />
          </ScrollArea>
        ) : null}

        {loaded && activeTab === "help" ? (
          <ScrollArea className="flex-1">
            <div className="p-3">
              <Card className="border border-border/50 bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">{t.helpTitle}</h2>

                <h3 className="mb-1.5 border-l-2 border-foreground/10 pl-2 text-xs font-medium text-foreground/60">{t.helpWindowOps}</h3>
                <ul className="mb-4 space-y-1.5 text-[13px] text-muted-foreground">
                  {t.helpWindowOpsItems.map(([label, desc], i) => (
                    <li key={i}><span className="font-medium text-foreground">{label}：</span>{desc}</li>
                  ))}
                </ul>

                <h3 className="mb-1.5 border-l-2 border-foreground/10 pl-2 text-xs font-medium text-foreground/60">{t.helpClipboard}</h3>
                <ul className="mb-4 space-y-1.5 text-[13px] text-muted-foreground">
                  {t.helpClipboardItems.map(([label, desc], i) => (
                    <li key={i}><span className="font-medium text-foreground">{label}：</span>{desc}</li>
                  ))}
                </ul>

                <h3 className="mb-1.5 border-l-2 border-foreground/10 pl-2 text-xs font-medium text-foreground/60">{t.helpGroups}</h3>
                <ul className="mb-4 space-y-1.5 text-[13px] text-muted-foreground">
                  {t.helpGroupsItems.map(([label, desc], i) => (
                    <li key={i}><span className="font-medium text-foreground">{label}：</span>{desc}</li>
                  ))}
                </ul>

                <h3 className="mb-1.5 border-l-2 border-foreground/10 pl-2 text-xs font-medium text-foreground/60">{t.helpKeyboard}</h3>
                <ul className="mb-4 space-y-1.5 text-[13px] text-muted-foreground">
                  {t.helpKeyboardItems.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>

                <h3 className="mb-1.5 border-l-2 border-foreground/10 pl-2 text-xs font-medium text-foreground/60">{t.helpSettings}</h3>
                <ul className="space-y-1.5 text-[13px] text-muted-foreground">
                  {t.helpSettingsItems.map(([label, desc], i) => (
                    <li key={i}><span className="font-medium text-foreground">{label}：</span>{desc}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </ScrollArea>
        ) : null}

        {loaded && activeTab === "about" ? <AboutPanel /> : null}
      </div>

      {/* Confirm Dialog */}
      {confirm ? (
        <ConfirmDialog
          open
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel}
          variant={confirm.variant}
          onConfirm={() => void handleConfirm()}
          onCancel={() => void handleCancel()}
        />
      ) : null}

    </main>
  );
}
