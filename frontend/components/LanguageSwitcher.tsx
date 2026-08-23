"use client";

import { LANGUAGES, useI18n } from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();

  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="sr-only">{lang === "en" ? "Language" : lang === "uz" ? "Til" : "Язык"}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as "en" | "uz" | "ru")}
        className="rounded-lg border border-ink-300 bg-transparent px-2 py-1.5 text-sm text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-ink-700 dark:text-ink-200"
        aria-label="Language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
