import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { zh } from "./locales/zh";
import { en } from "./locales/en";

export type Locale = "zh-CN" | "en";
export type Translations = typeof zh;

const dictionaries: Record<Locale, Translations> = { "zh-CN": zh, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "zh-CN",
  setLocale: () => {},
  t: zh,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleRaw] = useState<Locale>(() => {
    return (localStorage.getItem("trayclip-locale") as Locale) || "zh-CN";
  });
  const fromExternal = useRef(false);

  // Exposed setter: user-initiated change, always emits
  const setLocale = (next: Locale) => {
    fromExternal.current = false;
    setLocaleRaw(next);
  };

  // Persist & broadcast
  useEffect(() => {
    localStorage.setItem("trayclip-locale", locale);
    if (fromExternal.current) {
      fromExternal.current = false;
    } else {
      void emit("locale://changed", locale);
    }
  }, [locale]);

  // Tauri cross-window event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<Locale>("locale://changed", (e) => {
      fromExternal.current = true;
      setLocaleRaw(e.payload);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Browser storage event (fallback)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "trayclip-locale" && e.newValue && e.newValue !== locale) {
        fromExternal.current = true;
        setLocaleRaw(e.newValue as Locale);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [locale]);

  const t = dictionaries[locale] ?? zh;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
