"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useI18n } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function LogoMark() {
  return (
    <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 via-brand-500 to-cyan-400 shadow-glow-sm">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 3.5A5.5 5.5 0 0 1 17.5 12l-5.5 3V6.5Z" fill="currentColor" />
        <circle cx="12" cy="12" r="2.5" fill="#fff" />
      </svg>
    </span>
  );
}

/* ---------- Small icon set for menus ---------- */

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </>
  ),
  credits: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />,
  shield: <path d="M12 3 5 5.8v5c0 4.4 3 8.6 7 10.2 4-1.6 7-5.8 7-10.2v-5L12 3Z" strokeLinejoin="round" />,
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" strokeLinecap="round" />
      <path d="M10 17l-5-5 5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />,
};

function MenuIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px] shrink-0">
      {ICONS[name]}
    </svg>
  );
}

function Avatar({ email, size = "md" }: { email: string; size?: "md" | "lg" }) {
  const letter = (email || "?").trim().charAt(0).toUpperCase();
  const dims = size === "lg" ? "h-11 w-11 text-base" : "h-8 w-8 text-xs";
  return (
    <span
      className={`inline-flex ${dims} shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-accent-500 via-brand-500 to-cyan-400 font-bold text-white shadow-glow-sm ring-2 ring-white/20 dark:ring-white/10`}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

export function Nav() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setTheme(stored === "light" ? "light" : "dark");
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  /* Close the account dropdown on outside click or Escape */
  useEffect(() => {
    if (!accountOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

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
      setAccountOpen(false);
      router.push("/");
      router.refresh();
    }
  };

  const navLinkClass =
    "rounded-lg px-2 py-1.5 text-sm font-medium text-ink-600 transition hover:bg-ink-100/70 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-white/[0.07] dark:hover:text-white";

  const isActive = (href: string) =>
    href.startsWith("/#") ? false : pathname === href || pathname.startsWith(href + "/");

  const menuItemClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-800 dark:text-ink-200 dark:hover:bg-white/[0.07] dark:hover:text-white";

  const primaryLinks = (
    <>
      <Link href="/#how-it-works" className={`hidden sm:inline-block ${navLinkClass}`}>
        {t("navHowItWorks")}
      </Link>
      <Link href="/#features" className={`hidden sm:inline-block ${navLinkClass}`}>
        {t("navFeatures")}
      </Link>
      <Link href="/contact" className={`${navLinkClass} ${isActive("/contact") ? "text-brand-600 dark:text-accent-300" : ""}`}>
        {t("navContact")}
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-white/75 backdrop-blur-xl dark:border-white/[0.06] dark:bg-ink-950/70 no-print">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark />
          <span className="text-sm font-bold tracking-tight transition group-hover:text-brand-600 dark:group-hover:text-accent-300 sm:text-base">
            {t("appName")}
          </span>
        </Link>

        {/* Center navigation */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {primaryLinks}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              {/* Premium credits pill */}
              <Link
                href="/credits"
                title={t("navCredits")}
                className="glow-border hidden !rounded-full shadow-none transition hover:shadow-glow-sm sm:block"
              >
                <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-ink-800 backdrop-blur dark:bg-ink-900/90 dark:text-ink-100">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5 text-amber-500">
                    {ICONS.credits}
                  </svg>
                  {user.credits ?? 0}
                </span>
              </Link>

              {/* Account chip + dropdown */}
              <div ref={accountRef} className="relative">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label={t("navAccount")}
                  className={`flex items-center gap-2 rounded-full border p-1 pr-2 transition ${
                    accountOpen
                      ? "border-accent-500/50 bg-accent-500/10"
                      : "border-ink-300/70 hover:border-brand-400/70 hover:bg-brand-50/60 dark:border-white/12 dark:hover:border-accent-500/40 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <Avatar email={user.email} />
                  <MenuIcon name="chevron" />
                </button>

                {accountOpen ? (
                  <div
                    role="menu"
                    className="glass absolute right-0 top-full mt-2 w-72 origin-top-right !p-2 shadow-glow-sm animate-fade-up"
                  >
                    {/* Identity header */}
                    <div className="flex items-center gap-3 border-b border-ink-200/60 px-3 pb-3 pt-2 dark:border-white/[0.07]">
                      <Avatar email={user.email} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{user.email}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {user.is_admin ? (
                            <span className="badge bg-gradient-to-r from-accent-600 to-brand-600 text-[10px] uppercase tracking-wider text-white">
                              {t("navAdminBadge")}
                            </span>
                          ) : null}
                          <span className="text-xs text-ink-400">
                            {t("navCredits")}: <strong className={user.credits === 0 ? "text-red-500" : "text-emerald-500"}>{user.credits ?? 0}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="pt-2">
                      <Link href="/dashboard" role="menuitem" className={menuItemClass}>
                        <MenuIcon name="dashboard" />
                        {t("navDashboard")}
                      </Link>
                      <Link href="/history" role="menuitem" className={menuItemClass}>
                        <MenuIcon name="history" />
                        {t("navHistory")}
                      </Link>
                      <Link href="/credits" role="menuitem" className={menuItemClass}>
                        <MenuIcon name="credits" />
                        {t("navCredits")}
                        <span className="ml-auto rounded-md bg-brand-100 px-1.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-accent-500/15 dark:text-accent-300">
                          {user.credits ?? 0}
                        </span>
                      </Link>
                      {user.is_admin ? (
                        <Link href="/admin" role="menuitem" className={menuItemClass}>
                          <MenuIcon name="shield" />
                          {t("navAdmin")}
                        </Link>
                      ) : null}
                    </div>

                    {/* Logout */}
                    <div className="mt-1 border-t border-ink-200/60 pt-1 dark:border-white/[0.07]">
                      <button
                        onClick={() => void logout()}
                        role="menuitem"
                        className={`${menuItemClass} !text-red-600 hover:!bg-red-50 hover:!text-red-700 dark:!text-red-400 dark:hover:!bg-red-950/30 dark:hover:!text-red-300`}
                      >
                        <MenuIcon name="logout" />
                        {t("navLogout")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <Link href="/login" className="btn-primary hidden !px-4 !py-2 !text-xs md:inline-flex">
              {t("navLogin")}
            </Link>
          )}
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("navThemeDark") : t("navThemeLight")}
            className="rounded-lg border border-ink-300 p-2 text-ink-600 transition hover:bg-ink-100 dark:border-white/[0.12] dark:text-ink-300 dark:hover:bg-white/[0.07]"
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
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="rounded-lg border border-ink-300 p-2 text-ink-600 transition hover:bg-ink-100 dark:border-white/[0.12] dark:text-ink-300 dark:hover:bg-white/[0.07] lg:hidden"
          >
            {menuOpen ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen ? (
        <div className="border-t border-ink-200/60 bg-white/95 px-4 pb-4 pt-2 backdrop-blur-xl dark:border-white/[0.06] dark:bg-ink-950/95 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {primaryLinks}

            {user ? (
              <>
                <div className="my-2 h-px bg-ink-200/60 dark:bg-white/[0.07]" />
                <div className="mb-1 flex items-center gap-3 px-2 py-1">
                  <Avatar email={user.email} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.email}</p>
                    <p className="text-xs text-ink-400">
                      {t("navCredits")}: <strong>{user.credits ?? 0}</strong>
                    </p>
                  </div>
                </div>
                <Link href="/dashboard" className={menuItemClass}>
                  <MenuIcon name="dashboard" /> {t("navDashboard")}
                </Link>
                <Link href="/history" className={menuItemClass}>
                  <MenuIcon name="history" /> {t("navHistory")}
                </Link>
                <Link href="/credits" className={menuItemClass}>
                  <MenuIcon name="credits" /> {t("navCredits")}
                </Link>
                {user.is_admin ? (
                  <Link href="/admin" className={menuItemClass}>
                    <MenuIcon name="shield" /> {t("navAdmin")}
                  </Link>
                ) : null}
                <button onClick={() => void logout()} className={`${menuItemClass} !text-red-600 dark:!text-red-400`}>
                  <MenuIcon name="logout" /> {t("navLogout")}
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-primary mt-2">
                {t("navLogin")}
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
