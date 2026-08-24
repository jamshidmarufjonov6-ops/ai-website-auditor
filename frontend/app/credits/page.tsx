"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import type { CreditsInfo } from "@/lib/types";

export default function CreditsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getCredits()
      .then(setCredits)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
        } else {
          setError(err instanceof Error ? err.message : "");
        }
      });
  }, [router]);

  const buy = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.checkout();
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("creditsErrorDefault"));
      setBusy(false);
    }
  };

  return (
    <main className="container-page py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">{t("creditsTitle")}</h1>
        <p className="mt-3 text-ink-600 dark:text-ink-300">{t("creditsSubtitle")}</p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300" role="alert">
            {error}
          </p>
        )}

        {!credits ? (
          <div className="mt-10 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" aria-hidden="true" />
            <p className="mt-4 text-sm text-ink-500">{t("creditsLoading")}</p>
          </div>
        ) : (
          <>
            <div className="card mt-8 p-8 text-center">
              <p className="text-sm text-ink-500 dark:text-ink-400">{t("creditsRemaining")}</p>
              <p className="mt-2 text-5xl font-extrabold tabular-nums">{credits.credits}</p>
            </div>

            <div className="card mt-6 flex flex-col items-center justify-between gap-6 p-8 sm:flex-row">
              <div>
                <h2 className="text-xl font-bold">{t("creditsPackTitle")}</h2>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                  {t("creditsPackDesc").replace("{count}", String(credits.pack.size))}
                </p>
                <p className="mt-2 text-2xl font-extrabold">${credits.pack.price_usd}</p>
              </div>
              {credits.payments_configured ? (
                <button onClick={buy} disabled={busy} className="btn-primary shrink-0">
                  {busy ? t("urlStarting") : t("creditsBuy")}
                </button>
              ) : (
                <p className="text-sm text-ink-500">{t("creditsNotConfigured")}</p>
              )}
            </div>

            <div className="mt-8 text-center">
              <Link href="/dashboard" className="btn-secondary">{t("creditsBackDashboard")}</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
