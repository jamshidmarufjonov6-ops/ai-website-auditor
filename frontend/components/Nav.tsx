"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Nav() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setTheme(stored === "light" ? "light" : "dark");
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      router.push("/");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/80 backdrop-blur dark:border-ink-800 dark:bg-ink-950/80 no-print">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path
                d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 3.5A5.5 5.5 0 0 1 17.5 12l-5.5 3V6.5Z"
                fill="currentColor"
              />
              <circle cx="12" cy="12" r="2.5" fill="#fff" />
            </svg>
          </span>
          <span className="hidden sm:inline">{t("appName")}</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4 text-sm" aria-label="Main navigation">
          <Link href="/#how-it-works" className="hidden text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white sm:inline">
            {t("navHowItWorks")}
          </Link>
          <Link href="/#features" className="hidden text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white sm:inline">
            {t("navFeatures")}
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white">
                {t("navDashboard")}
              </Link>
              <Link href="/history" className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white">
                {t("navHistory")}
              </Link>
              <Link href="/credits" className="text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white">
                {t("navCredits")} ({user.credits ?? 0})
              </Link>
              <span className="hidden text-xs text-ink-400 sm:inline">{user.email}</span>
              <button onClick={logout} className="btn-secondary !px-3 !py-1.5">
                {t("navLogout")}
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-secondary !px-3 !py-1.5">
              {t("navLogin")}
            </Link>
          )}
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("navThemeDark") : t("navThemeLight")}
            className="rounded-lg border border-ink-300 p-2 text-ink-600 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            {theme === "dark" ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
