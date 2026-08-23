"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import type { SubscriptionInfo } from "@/lib/types";

export default function PricingPage() {
  const { t } = useI18n();
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getSubscription()
      .then((s) => {
        setSub(s);
        setAuthed(true);
      })
      .catch((err) => {
        setAuthed(err instanceof ApiError && err.status === 401 ? false : true);
        if (!(err instanceof ApiError && err.status === 401)) setCheckoutError(err.message);
      });
  }, []);

  const upgrade = async () => {
    setBusy(true);
    setCheckoutError("");
    try {
      const res = await api.checkout();
      window.location.href = res.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t("billingNotConfigured"));
      setBusy(false);
    }
  };

  const price = sub?.pro_price_display || `$${19}/month`;

  return (
    <main className="container-page py-10 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("pricingTitle")}</h1>
        <p className="mt-3 text-ink-600 dark:text-ink-300">{t("pricingSubtitle")}</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {/* Free */}
        <div className="card flex flex-col p-8">
          <h2 className="text-xl font-bold">{t("pricingFree")}</h2>
          <p className="mt-2 text-3xl font-extrabold">{t("pricingFreePrice")}</p>
          <ul className="mt-6 space-y-2 text-sm text-ink-600 dark:text-ink-300">
            <li>• {t("pricingFreeF1")}</li>
            <li>• {t("pricingFreeF2")}</li>
            <li>• {t("pricingFreeF3")}</li>
            <li>• {t("pricingFreeF4")}</li>
            <li>• {t("pricingFreeF5")}</li>
          </ul>
          <div className="mt-8">
            {authed && sub?.plan === "free" ? (
              <span className="btn-secondary w-full text-center">{t("pricingCurrentPlan")}</span>
            ) : (
              <Link href="/" className="btn-primary w-full text-center">{t("ctaButton")}</Link>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="card flex flex-col border-brand-300 p-8 dark:border-brand-700">
          <h2 className="text-xl font-bold">{t("pricingPro")}</h2>
          <p className="mt-2 text-3xl font-extrabold">{price}</p>
          <ul className="mt-6 space-y-2 text-sm text-ink-600 dark:text-ink-300">
            <li>• {t("pricingProF1")}</li>
            <li>• {t("pricingProF2")}</li>
            <li>• {t("pricingProF3")}</li>
            <li>• {t("pricingProF4")}</li>
            <li>• {t("pricingProF5")}</li>
            <li>• {t("pricingProF6")}</li>
          </ul>
          <div className="mt-8">
            {authed === false ? (
              <Link href="/register" className="btn-primary w-full text-center">{t("pricingUpgrade")}</Link>
            ) : sub?.plan === "pro" ? (
              <span className="btn-secondary w-full text-center">{t("pricingCurrentPlan")}</span>
            ) : (
              <button onClick={upgrade} disabled={busy} className="btn-primary w-full">
                {busy ? t("urlStarting") : t("pricingUpgrade")}
              </button>
            )}
          </div>
          {checkoutError && (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200" role="alert">
              {checkoutError}
            </p>
          )}
          {sub?.payments_configured === false && (
            <p className="mt-4 text-sm text-ink-500">{t("pricingNotConfigured")}</p>
          )}
        </div>
      </div>
    </main>
  );
}
