"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";
import { ru } from "./ru";
import { uz } from "./uz";
import { CHECK_TITLES_EN, CHECK_TITLES_RU, CHECK_TITLES_UZ } from "./checkTitles";

export type Lang = "en" | "uz" | "ru";

const DICTS: Record<Lang, Record<string, string>> = { en, uz, ru };
const CHECK_TITLES: Record<Lang, Record<string, string>> = {
  en: CHECK_TITLES_EN,
  uz: CHECK_TITLES_UZ,
  ru: CHECK_TITLES_RU,
};

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  tc: (checkId: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  tc: (_id, fallback) => fallback || "",
});

const STORAGE_KEY = "auditor_lang";

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "uz" || stored === "ru") return stored;
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const setLang = (next: Lang) => setLangState(next);

  const t = (key: string): string => {
    const dict = DICTS[lang] || DICTS.en;
    return dict[key] ?? DICTS.en[key] ?? key;
  };

  const tc = (checkId: string, fallback?: string): string => {
    const titles = CHECK_TITLES[lang] || CHECK_TITLES.en;
    return titles[checkId] ?? CHECK_TITLES.en[checkId] ?? fallback ?? checkId;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tc }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "uz", label: "Uzbek", native: "O'zbekcha" },
  { code: "ru", label: "Russian", native: "Русский" },
];
