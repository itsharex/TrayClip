import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { backupData, checkUpdate, clearHistory, deleteClip, deleteGroup, downloadAndInstallUpdate, getBootstrap, hideWindow, moveClipToGroup, pinToggle, quitApp, recopyClip, restoreBackup, saveGroup, updateHotkey, updateSettings } from "./lib/api";
import type { AppSettings, BootstrapPayload, ClipGroup } from "./lib/types";
import { useTranslation } from "./lib/i18n";
import { useAppVersion } from "./hooks/useAppVersion";
import { HistoryList } from "./components/HistoryList";
import { SettingsPanel } from "./components/SettingsPanel";

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
    quick_paste: false,
    url_toast: false,
  },
  hotkeys: [],
  permissions: {
    accessibility_granted: false,
    accessibility_required_for_paste: true,
  },
};

type TabKey = "clips" | "settings" | "help" | "about";

interface ConfirmState {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
}

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "done";

function AboutPanel() {
  const { t } = useTranslation();
  const version = useAppVersion();
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateBody, setUpdateBody] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const updateRef = useRef<{ version: string; download_url: string; signature: string } | null>(null);
  const [upToDate, setUpToDate] = useState(false);

  const handleCheck = async () => {
    setPhase("checking");
    setError(null);
    setUpToDate(false);
    try {
      const update = await checkUpdate();
      if (update) {
        updateRef.current = update;
        setUpdateVersion(update.version);
        setUpdateBody(update.body ?? null);
        setPhase("available");
      } else {
        setPhase("idle");
        setUpdateVersion(null);
        setUpdateBody(null);
        setUpToDate(true);
      }
    } catch (e) {
      console.error("[updater] check failed:", e);
      setError(String(e));
      setPhase("idle");
    }
  };

  const handleInstall = async () => {
    const update = updateRef.current;
    if (!update) return;
    setPhase("downloading");
    setProgress(0);
    setError(null);
    try {
      let contentLength = 0;
      let downloaded = 0;
      await downloadAndInstallUpdate(update.download_url, update.signature, (event) => {
        if (event.event === "started") {
          contentLength = event.contentLength ?? 0;
        } else if (event.event === "progress") {
          downloaded += event.chunkLength;
          if (contentLength > 0) {
            setProgress(Math.round((downloaded / contentLength) * 100));
          }
        } else if (event.event === "finished") {
          setProgress(100);
        }
      });
      // The installer launches and exits the app
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("available");
    }
  };

  return (
      <section className="tab-panel about-panel">
        <div className="about-logo">
          <img src="/logo.png" alt="TrayClip" width={80} height={80} />
        </div>
        <h2>{t.aboutTitle}</h2>
        <p>{t.aboutDesc}</p>
        <ul>
          <li>{t.aboutVersion(version)}</li>
          <li>{t.aboutStorage}</li>
          <li>{t.aboutPlatform}</li>
          <li>{t.aboutLicense}</li>
          <li>Github：<a href="https://github.com/Heyiki/TrayClip" target="_blank" rel="noopener noreferrer">https://github.com/Heyiki/TrayClip</a></li>
        </ul>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => void handleCheck()} disabled={phase === "checking" || phase === "downloading" || phase === "installing"}>
            {phase === "checking" ? t.checking : t.checkUpdate}
          </button>
        </div>
        {upToDate && phase === "idle" ? (
            <p style={{ color: "var(--text-tertiary)", margin: "8px 0 0" }}>{t.upToDate}</p>
        ) : null}
        {phase === "available" && updateVersion ? (
            <div className="update-result">
              <p style={{ color: "var(--primary)", margin: "8px 0 4px" }}>{t.newVersion(updateVersion)}</p>
              {updateBody ? <pre className="update-changelog">{updateBody}</pre> : null}
              <button className="update-install-btn" onClick={() => void handleInstall()}>
                {t.installUpdate}
              </button>
            </div>
        ) : null}
        {phase === "downloading" ? (
            <div className="update-result">
              <p style={{ color: "var(--primary)", margin: "8px 0 4px" }}>{t.downloading(progress)}</p>
              <div className="update-progress-bar">
                <div className="update-progress-bar__fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
        ) : null}
        {phase === "installing" ? (
            <div className="update-result">
              <p style={{ color: "var(--primary)", margin: "8px 0 4px" }}>{t.installing}</p>
            </div>
        ) : null}
        {phase === "done" ? (
            <div className="update-result">
              <p style={{ color: "var(--primary)", margin: "8px 0 4px" }}>{t.installing}</p>
            </div>
        ) : null}
        {error ? <p style={{ color: "var(--danger)", margin: "8px 0 0", fontSize: 12 }}>{t.checkFailed(error)}</p> : null}
      </section>
  );
}

export default function App() {
  const { t, locale, setLocale } = useTranslation();
  const [state, setState] = useState<BootstrapPayload>(fallback);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => { document.querySelector(".history-list")?.scrollTo(0, 0); }, [search]);
  const [newGroupName, setNewGroupName] = useState("");
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("clips");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("trayclip-theme") as "light" | "dark") || "light";
  });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const noticeTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef(state.settings);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 1500);
  }, []);

  const focusSearch = useCallback((selectText = false) => {
    setActiveTab("clips");
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      if (selectText) input.select();
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const payload = await getBootstrap();
      setState(payload);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    win.onFocusChanged(({ payload: focused }) => {
      if (focused) void load();
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [load]);

  useEffect(() => {
    settingsRef.current = state.settings;
  }, [state.settings]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("trayclip-theme", theme);
    void emit("theme://changed", theme);
  }, [theme]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setSettingsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  useEffect(() => {
    let unlistenClips: (() => void) | undefined;
    let unlistenFocusSearch: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;

    void listen("clips://updated", () => {
      void load();
    }).then((fn) => {
      unlistenClips = fn;
    });

    void listen("focus-main-search", () => {
      scrollRef.current?.scrollTo(0, 0);
      focusSearch(true);
    }).then((fn) => {
      unlistenFocusSearch = fn;
    });

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
          onConfirm: async () => {
            await hideWindow();
          },
          onCancel: async () => {
            await quitApp();
          },
        });
      }
    }).then((fn) => {
      unlistenClose = fn;
    });

    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
      unlistenClips?.();
      unlistenFocusSearch?.();
      unlistenClose?.();
    };
  }, [focusSearch, load]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (confirm || activeTab !== "clips") return;
      if (event.key !== "Escape") return;

      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const isSearchInput = target === searchInputRef.current;

      if (isEditable && !isSearchInput) return;

      event.preventDefault();
      if (search) {
        setSearch("");
        focusSearch(false);
        return;
      }
      void hideWindow();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [activeTab, confirm, focusSearch, search]);

  const filteredClips = useMemo(() => {
    return state.clips.items.filter((clip) => {
      const byGroup = selectedGroupId === null || clip.group_id === selectedGroupId;
      const bySearch = `${clip.summary} ${clip.plain_text ?? ""} ${clip.source_app} ${clip.file_paths.join(" ")}`.toLowerCase().includes(search.toLowerCase());
      return byGroup && bySearch;
    });
  }, [search, selectedGroupId, state.clips.items]);

  const saveSettings = useCallback(async (next: AppSettings) => {
    setState((current) => ({ ...current, settings: next }));
    const updated = await updateSettings(next);
    setState((current) => ({ ...current, settings: updated }));
    void emit("settings://changed", updated);
  }, []);

  const handleWindowClose = useCallback(async () => {
    const behavior = settingsRef.current.close_behavior;
    if (behavior === "hide") {
      await hideWindow();
      return;
    }
    if (behavior === "exit") {
      await quitApp();
      return;
    }
    setConfirm({
      message: t.confirmClose,
      confirmLabel: t.hideToTray,
      cancelLabel: t.exitApp,
      onConfirm: async () => {
        await hideWindow();
      },
      onCancel: async () => {
        await quitApp();
      },
    });
  }, [t]);

  const createGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (state.groups.some((g) => g.name === name)) {
      showNotice(t.groupNameExists);
      return;
    }
    await saveGroup(null, name);
    setNewGroupName("");
    setShowGroupInput(false);
    await load();
  }, [newGroupName, state.groups, load, showNotice, t]);

  const startRename = useCallback((group: ClipGroup) => {
    setRenamingGroupId(group.id);
    setRenameValue(group.name);
  }, []);

  const commitRename = useCallback(async () => {
    if (renamingGroupId === null) return;
    const name = renameValue.trim();
    if (!name) {
      setRenamingGroupId(null);
      return;
    }
    if (state.groups.some((g) => g.name === name && g.id !== renamingGroupId)) {
      showNotice(t.groupNameExists);
      return;
    }
    await saveGroup(renamingGroupId, name);
    setRenamingGroupId(null);
    await load();
  }, [renamingGroupId, renameValue, state.groups, load, showNotice, t]);

  const removeGroup = useCallback((group: ClipGroup) => {
    setConfirm({
      message: t.confirmDeleteGroup(group.name),
      onConfirm: async () => {
        await deleteGroup(group.id);
        if (selectedGroupId === group.id) setSelectedGroupId(null);
        await load();
        showNotice(t.groupDeleted);
      },
    });
  }, [selectedGroupId, load, showNotice, t]);

  const handleClearHistory = useCallback(() => {
    setConfirm({
      message: t.confirmClearHistory,
      onConfirm: async () => {
        await clearHistory();
        await load();
        showNotice(t.historyCleared);
      },
    });
  }, [load, showNotice, t]);

  const handleDeleteClip = useCallback((clipId: number) => {
    setConfirm({
      message: t.confirmDeleteClip,
      onConfirm: async () => {
        await deleteClip(clipId);
        await load();
        showNotice(t.clipDeleted);
      },
    });
  }, [load, showNotice, t]);

  const handleBackup = useCallback(async () => {
    const filePath = await save({
      filters: [{ name: "ZIP", extensions: ["zip"] }],
      defaultPath: `trayclip-backup-${new Date().toISOString().slice(0, 10)}.zip`,
    });
    if (!filePath) return;
    await backupData(filePath);
    showNotice(t.backupSuccess);
  }, [showNotice, t]);

  const handleRestore = useCallback(() => {
    setConfirm({
      message: t.confirmRestore,
      confirmLabel: t.restore,
      onConfirm: async () => {
        const filePath = await open({
          multiple: false,
          filters: [{ name: "TrayClip Backup", extensions: ["zip"] }],
        });
        if (!filePath) return;
        await restoreBackup(filePath as string);
      },
    });
  }, [t]);

  const handleRecopy = useCallback(async (clipId: number) => {
    await recopyClip(clipId);
    await load();
    showNotice(t.copiedToClipboard);
  }, [load, showNotice, t]);

  return (
      <main className="app-shell">
        <header className="window-bar" onMouseDown={(e) => { if (e.button === 0) getCurrentWindow().startDragging(); }}>
          <div className="window-bar__brand">
            <span className="window-bar__title" onClick={() => setActiveTab("clips")} onMouseDown={(e) => e.stopPropagation()} style={{ cursor: "pointer" }}>{t.brand}</span>
          </div>
          <div className="window-bar__actions" onMouseDown={(e) => e.stopPropagation()}>
            <button
                className="window-bar__theme"
                type="button"
                aria-label={t.toggleLang}
                onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
                title={t.toggleLang}
            >
              {locale === "zh-CN" ? "En" : "中"}
            </button>
            <button
                className="window-bar__theme"
                type="button"
                aria-label={t.toggleTheme}
                onClick={() => setTheme((th) => th === "light" ? "dark" : "light")}
                title={t.toggleTheme}
            >
              {theme === "light" ? "🌙" : "☀"}
            </button>
            <div className="window-bar__settings" ref={settingsMenuRef}>
              <button
                  className={settingsMenuOpen ? "window-bar__settings-btn active" : "window-bar__settings-btn"}
                  type="button"
                  aria-label={t.settings}
                  onClick={() => setSettingsMenuOpen((open) => !open)}
              >
                {t.settings}
              </button>
              {settingsMenuOpen ? (
                  <div className="window-bar__settings-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setActiveTab("clips"); setSettingsMenuOpen(false); }}>{t.home}</button>
                    <button type="button" role="menuitem" onClick={() => { setActiveTab("settings"); setSettingsMenuOpen(false); }}>{t.settings}</button>
                    <button type="button" role="menuitem" onClick={() => { setActiveTab("help"); setSettingsMenuOpen(false); }}>{t.help}</button>
                    <button type="button" role="menuitem" onClick={() => { setActiveTab("about"); setSettingsMenuOpen(false); }}>{t.about}</button>
                  </div>
              ) : null}
            </div>
            <button
                className="window-bar__close"
                type="button"
                aria-label={t.closeWindow}
                onClick={() => void handleWindowClose()}
            >
              ×
            </button>
          </div>
        </header>

        <section className="workspace">
          {activeTab === "clips" ? (
              <section className="tab-panel">
                <div className="toolbar">
                  <div className="toolbar-row">
                    <input
                        ref={searchInputRef}
                        className="toolbar-search"
                        placeholder={t.searchPlaceholder}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </div>

                <div className="group-bar">
                  <button
                      className={selectedGroupId === null ? "group-tag active" : "group-tag"}
                      onClick={() => setSelectedGroupId(null)}
                  >
                    {t.all}
                  </button>
                  {state.groups.map((group) => (
                      renamingGroupId === group.id ? (
                          <input
                              key={group.id}
                              autoFocus
                              className="group-rename-input"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void commitRename();
                                if (e.key === "Escape") setRenamingGroupId(null);
                              }}
                              onBlur={() => void commitRename()}
                              maxLength={10}
                          />
                      ) : (
                          <button
                              key={group.id}
                              className={selectedGroupId === group.id ? "group-tag active" : "group-tag"}
                              onClick={() => setSelectedGroupId(group.id)}
                              onDoubleClick={() => startRename(group)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                removeGroup(group);
                              }}
                              title={t.renameGroupHint(group.name)}
                          >
                            {group.name}
                          </button>
                      )
                  ))}
                  {showGroupInput ? (
                      <div className="group-creator-inline">
                        <input
                            autoFocus
                            className="group-creator-input"
                            placeholder={t.groupNamePlaceholder}
                            maxLength={10}
                            value={newGroupName}
                            onChange={(event) => setNewGroupName(event.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void createGroup();
                              if (e.key === "Escape") {
                                setShowGroupInput(false);
                                setNewGroupName("");
                              }
                            }}
                            onBlur={() => {
                              if (!newGroupName.trim()) setShowGroupInput(false);
                            }}
                        />
                      </div>
                  ) : (
                      <button className="group-add-btn" onClick={() => setShowGroupInput(true)} title={t.createGroup}>+</button>
                  )}
                </div>

                <section className="content-column">
                  <div className="content-toolbar">
                    <span className="content-count">{t.recordsCount(!search && selectedGroupId === null ? state.clips.total : filteredClips.length)}</span>
                  </div>

                  <HistoryList
                      clips={filteredClips}
                      groups={state.groups}
                      scrollRef={scrollRef}
                      onRecopy={handleRecopy}
                      onPinToggle={async (clipId, pinned) => {
                        await pinToggle(clipId, pinned);
                        await load();
                      }}
                      onMoveGroup={async (clipId, groupId) => {
                        await moveClipToGroup(clipId, groupId);
                        await load();
                      }}
                      onDelete={handleDeleteClip}
                  />
                </section>
              </section>
          ) : null}

          {activeTab === "settings" ? (
              <section className="tab-panel">
                <SettingsPanel
                    settings={state.settings}
                    hotkeys={state.hotkeys}
                    onSettingsChange={saveSettings}
                    onHotkeyChange={async (actionKey, hotkeyValue) => {
                      await updateHotkey(actionKey, hotkeyValue);
                      await load();
                    }}
                    onBackup={handleBackup}
                    onRestore={handleRestore}
                    onClearHistory={handleClearHistory}
                />
              </section>
          ) : null}

          {activeTab === "help" ? (
              <section className="tab-panel about-panel">
                <h2>{t.helpTitle}</h2>

                <h3>{t.helpWindowOps}</h3>
                <ul>
                  {t.helpWindowOpsItems.map(([label, desc], i) => (
                      <li key={i}><b>{label}：</b>{desc}</li>
                  ))}
                </ul>

                <h3>{t.helpClipboard}</h3>
                <ul>
                  {t.helpClipboardItems.map(([label, desc], i) => (
                      <li key={i}><b>{label}：</b>{desc}</li>
                  ))}
                </ul>

                <h3>{t.helpGroups}</h3>
                <ul>
                  {t.helpGroupsItems.map(([label, desc], i) => (
                      <li key={i}><b>{label}：</b>{desc}</li>
                  ))}
                </ul>

                <h3>{t.helpKeyboard}</h3>
                <ul>
                  {t.helpKeyboardItems.map((item, i) => (
                      <li key={i}>{item}</li>
                  ))}
                </ul>

                <h3>{t.helpSettings}</h3>
                <ul>
                  {t.helpSettingsItems.map(([label, desc], i) => (
                      <li key={i}><b>{label}：</b>{desc}</li>
                  ))}
                </ul>
              </section>
          ) : null}

          {activeTab === "about" ? (
              <AboutPanel />
          ) : null}
        </section>

        {confirm ? (
            <div className="confirm-overlay" onClick={() => setConfirm(null)}>
              <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <p>{confirm.message}</p>
                <div className="confirm-dialog__actions">
                  <button
                      onClick={async () => {
                        try {
                          if (confirm.onCancel) {
                            await confirm.onCancel();
                          }
                        } catch (err) {
                          console.error("操作失败:", err);
                          showNotice(t.operationFailed);
                        } finally {
                          setConfirm(null);
                        }
                      }}
                  >
                    {confirm.cancelLabel ?? t.cancel}
                  </button>
                  <button
                      className={confirm.cancelLabel ? "primary" : "danger"}
                      onClick={async () => {
                        try {
                          await confirm.onConfirm();
                        } catch (err) {
                          console.error("操作失败:", err);
                          showNotice(t.operationFailed);
                        } finally {
                          setConfirm(null);
                        }
                      }}
                  >
                    {confirm.confirmLabel ?? t.confirm}
                  </button>
                </div>
              </div>
            </div>
        ) : null}

        {notice ? <div className="toast">{notice}</div> : null}
      </main>
  );
}
