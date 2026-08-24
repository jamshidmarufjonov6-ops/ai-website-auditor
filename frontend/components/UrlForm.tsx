"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/lib/api";

export function UrlForm({ compact = false, ctaLabel }: { compact?: boolean; ctaLabel?: string }) {
  const { t, lang } = useI18n();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setLimitReached(false);
    try {
      const audit = await api.createAudit(url.trim(), lang);
      router.push(`/audit/${audit.public_id}`);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      if (apiErr?.code === "monthly_limit_reached") {
        setLimitReached(true);
        setError(apiErr.message);
      } else {
        setError(err instanceof Error ? err.message : t("urlErrorDefault"));
      }
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex w-full flex-col gap-3 sm:flex-row">
        <label htmlFor={compact ? "audit-url-compact" : "audit-url-hero"} className="sr-only">
          {t("urlInputLabel")}
        </label>
        <input
          id={compact ? "audit-url-compact" : "audit-url-hero"}
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("urlPlaceholder")}
          autoComplete="url"
          className="input flex-1"
          disabled={loading}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={loading}>
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              {t("urlStarting")}
            </>
          ) : compact ? (
            t("urlAuditWebsite")
          ) : (
            ctaLabel || t("urlStartFreeAudit")
          )}
        </button>
      </form>
      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
      {limitReached && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          {t("urlUpgradeCta")}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-400 dark:text-ink-400">
        {t("urlNote")}
      </p>
    </div>
  );
}
