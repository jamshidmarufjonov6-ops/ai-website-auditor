"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { api, ApiError, clearPendingAuditUrl, getPendingAuditUrl } from "@/lib/api";

export default function LoginPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.login(email, password);
      const pendingUrl = getPendingAuditUrl();
      if (pendingUrl) {
        clearPendingAuditUrl();
        try {
          const audit = await api.createAudit(pendingUrl, lang);
          router.push(`/audit/${audit.public_id}`);
          router.refresh();
          return;
        } catch (err) {
          if (err instanceof ApiError && err.code === "credits_exhausted") {
            setError(err.message);
            setLoading(false);
            router.push("/credits");
            return;
          }
          router.push("/dashboard");
          router.refresh();
          return;
        }
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginErrorDefault"));
      setLoading(false);
    }
  };

  return (
    <main className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t("loginSubtitle")}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">{t("loginEmail")}</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">{t("loginPassword")}</label>
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </div>
          {error && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t("loginLoggingIn") : t("loginButton")}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-500">
          {t("loginNoAccount")}{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">{t("loginCreateOne")}</Link>
        </p>
      </div>
    </main>
  );
}
