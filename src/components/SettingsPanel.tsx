import { useEffect, useState } from "react";
import type { AppSettings, HotkeyActionKey, HotkeySetting } from "../lib/types";
import { useTranslation, type Locale } from "../lib/i18n";

interface SettingsPanelProps {
  settings: AppSettings;
  hotkeys: HotkeySetting[];
  onSettingsChange: (next: AppSettings) => void;
  onHotkeyChange: (actionKey: HotkeyActionKey, hotkeyValue: string) => void;
  onBackup: () => void;
  onRestore: () => void;
  onClearHistory: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);
const isWindows = typeof navigator !== "undefined" && /Win/.test(navigator.platform ?? navigator.userAgent);

const DEFAULT_HOTKEYS: Record<HotkeyActionKey, string> = {
  open_main_window: isMac ? "Ctrl+Shift+P" : "Ctrl+Shift+Space",
  open_quick_panel: isMac ? "Ctrl+P" : "Ctrl+Shift+V",
};

const SPECIAL_KEYS: Record<string, string> = {
  " ": "Space",
};

function normalizeKey(key: string): string {
  return SPECIAL_KEYS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

function formatModifiers(event: KeyboardEvent): string[] {
  const mods: string[] = [];
  if (event.ctrlKey) mods.push("Ctrl");
  if (event.altKey) mods.push("Alt");
  if (event.shiftKey) mods.push("Shift");
  if (event.metaKey) mods.push("Meta");
  return mods;
}

function isModifierKey(key: string): boolean {
  return ["Control", "Alt", "Shift", "Meta"].includes(key);
}

const MAC_SYMBOLS: Record<string, string> = { Meta: "⌘", Alt: "⌥", Shift: "⇧", Ctrl: "⌃", Space: "Space" };

function formatHotkeyDisplay(combo: string): string {
  if (!isMac) return combo;
  return combo.split("+").map((p) => MAC_SYMBOLS[p] ?? p).join("");
}

interface HotkeyRecorderProps {
  actionKey: HotkeyActionKey;
  currentValue: string;
  onSave: (actionKey: HotkeyActionKey, hotkeyValue: string) => void;
}

function HotkeyRecorder({ actionKey, currentValue, onSave }: HotkeyRecorderProps) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecording(false);
        setPreview("");
        return;
      }

      if (isModifierKey(e.key)) {
        setPreview(formatModifiers(e).join("+") + "+");
        return;
      }

      const parts = formatModifiers(e);
      parts.push(normalizeKey(e.key));
      const combo = parts.join("+");
      setRecording(false);
      setPreview("");
      onSave(actionKey, combo);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, actionKey, onSave]);

  const handleBlur = () => {
    setTimeout(() => {
      setRecording(false);
      setPreview("");
    }, 150);
  };

  return (
      <div
          className={`hotkey-value${recording ? " recording" : ""}`}
          tabIndex={0}
          onClick={() => {
            setRecording(true);
            setPreview(t.pressHotkey);
          }}
          onBlur={handleBlur}
          style={{ cursor: "pointer" }}
      >
        {recording ? preview : formatHotkeyDisplay(currentValue)}
      </div>
  );
}

export function SettingsPanel({
                                settings,
                                hotkeys,
                                onSettingsChange,
                                onHotkeyChange,
                                onBackup,
                                onRestore,
                                onClearHistory,
                              }: SettingsPanelProps) {
  const { t, locale, setLocale } = useTranslation();
  const hotkeyMap = new Map(hotkeys.map((h) => [h.action_key, h.hotkey_value]));

  const HOTKEY_LABELS: Record<HotkeyActionKey, string> = {
    open_main_window: t.openMainWindow,
    open_quick_panel: t.openQuickPanel,
  };

  return (
      <section className="settings-panel">
        <div className="settings-section">
          <h3>{t.dataManagement}</h3>
          <div className="settings-stack-row">
            <label>{t.backupData}</label>
            <div className="settings-inline-actions">
              <button onClick={onBackup}>{t.backup}</button>
              <button onClick={onRestore}>{t.restore}</button>
            </div>
          </div>
          <div className="settings-row">
            <label>{t.retentionLimit}</label>
            <input
                type="number"
                min={50}
                max={10000}
                value={settings.retention_limit}
                onChange={(event) => {
                  const clamped = Math.max(50, Math.min(10000, Number(event.target.value) || 50));
                  onSettingsChange({ ...settings, retention_limit: clamped });
                }}
            />
          </div>
          <div className="settings-row">
            <label>{t.pauseCapture}</label>
            <label className="toggle-switch">
              <input
                  type="checkbox"
                  checked={settings.pause_capture}
                  onChange={(event) => onSettingsChange({ ...settings, pause_capture: event.target.checked })}
              />
              <span className="toggle-switch__track" />
            </label>
          </div>
          {isWindows ? (
              <div className="settings-row">
                <label>{t.quickPaste}</label>
                <label className="toggle-switch">
                  <input
                      type="checkbox"
                      checked={settings.quick_paste}
                      onChange={(event) => onSettingsChange({ ...settings, quick_paste: event.target.checked })}
                  />
                  <span className="toggle-switch__track" />
                </label>
              </div>
          ) : null}
          <div className="settings-row">
            <label>{t.urlToast}</label>
            <label className="toggle-switch">
              <input
                  type="checkbox"
                  checked={settings.url_toast}
                  onChange={(event) => onSettingsChange({ ...settings, url_toast: event.target.checked })}
              />
              <span className="toggle-switch__track" />
            </label>
          </div>
          <div className="settings-stack-row settings-stack-row--danger">
            <label>{t.clearHistory}</label>
            <div className="settings-inline-actions">
              <button className="danger" onClick={onClearHistory}>{t.clear}</button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>{t.aiEnhancement}</h3>
          <div className="settings-row">
            <label>{t.enableAi}</label>
            <label className="toggle-switch">
              <input
                  type="checkbox"
                  checked={settings.llm_enabled}
                  onChange={(event) => onSettingsChange({ ...settings, llm_enabled: event.target.checked })}
              />
              <span className="toggle-switch__track" />
            </label>
          </div>
          <div className={settings.llm_enabled ? "llm-config" : "llm-config llm-config--disabled"}>
            <div className="settings-row">
              <label>{t.llmApiUrl}</label>
              <input
                  type="text"
                  placeholder="https://api.openai.com/v1"
                  title={t.llmApiUrlHint}
                  disabled={!settings.llm_enabled}
                  value={settings.llm_api_url}
                  onChange={(e) => onSettingsChange({ ...settings, llm_api_url: e.target.value })}
              />
            </div>
            <div className="settings-row">
              <label>{t.llmApiKey}</label>
              <input
                  type="password"
                  placeholder="sk-..."
                  disabled={!settings.llm_enabled}
                  value={settings.llm_api_key}
                  onChange={(e) => onSettingsChange({ ...settings, llm_api_key: e.target.value })}
              />
            </div>
            <div className="settings-row">
              <label>{t.llmModel}</label>
              <input
                  type="text"
                  placeholder="gpt-4o-mini"
                  disabled={!settings.llm_enabled}
                  value={settings.llm_model}
                  onChange={(e) => onSettingsChange({ ...settings, llm_model: e.target.value })}
              />
            </div>
            <div className="settings-row">
              <label>{t.aiTranslate}</label>
              <label className="toggle-switch">
                <input
                    type="checkbox"
                    disabled={!settings.llm_enabled}
                    checked={settings.llm_ai_translate}
                    onChange={(event) => onSettingsChange({ ...settings, llm_ai_translate: event.target.checked })}
                />
                <span className="toggle-switch__track" />
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>{t.systemBehavior}</h3>
          <div className="settings-row">
            <label>{t.launchOnStartup}</label>
            <label className="toggle-switch">
              <input
                  type="checkbox"
                  checked={settings.launch_on_startup}
                  onChange={(event) => onSettingsChange({ ...settings, launch_on_startup: event.target.checked })}
              />
              <span className="toggle-switch__track" />
            </label>
          </div>
          <div className="settings-row">
            <label>{t.closeBehavior}</label>
            <select
                value={settings.close_behavior}
                onChange={(event) => onSettingsChange({ ...settings, close_behavior: event.target.value as "hide" | "exit" | "ask" })}
            >
              <option value="hide">{t.hideToTrayRecommended}</option>
              <option value="exit">{t.exitDirectly}</option>
              <option value="ask">{t.askEveryTime}</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{t.panelPosition}</label>
            <select
                value={settings.panel_position}
                onChange={(event) => onSettingsChange({ ...settings, panel_position: event.target.value as "center" | "follow_mouse" })}
            >
              <option value="center">{t.centerScreen}</option>
              <option value="follow_mouse">{t.followMouse}</option>
            </select>
          </div>
          <div className="settings-row">
            <label>{locale === "en" ? "Language" : "语言"}</label>
            <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>{t.hotkeys}</h3>
          {(Object.keys(HOTKEY_LABELS) as HotkeyActionKey[]).map((actionKey) => (
              <div key={actionKey} className="hotkey-row">
                <span className="hotkey-label">{HOTKEY_LABELS[actionKey]}</span>
                <div className="hotkey-input-group">
                  <HotkeyRecorder
                      actionKey={actionKey}
                      currentValue={hotkeyMap.get(actionKey) ?? DEFAULT_HOTKEYS[actionKey]}
                      onSave={onHotkeyChange}
                  />
                  <button
                      className="ghost"
                      onClick={() => onHotkeyChange(actionKey, DEFAULT_HOTKEYS[actionKey])}
                      title={t.restoreDefault}
                  >
                    {t.restoreDefault}
                  </button>
                </div>
              </div>
          ))}
        </div>
      </section>
  );
}
