"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("registerErrorMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("registerErrorShort"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.register(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("registerErrorDefault"));
      setLoading(false);
    }
  };

  return (
    <main className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold">{t("registerTitle")}</h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t("registerSubtitle")}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">{t("loginEmail")}</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">{t("loginPassword")}</label>
            <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            <p className="mt-1 text-xs text-ink-400">{t("registerPasswordHint")}</p>
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium">{t("registerConfirm")}</label>
            <input id="confirm" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          </div>
          {error && <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300" role="alert">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t("registerCreating") : t("registerButton")}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-500">
          {t("registerHaveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">{t("registerLogin")}</Link>
        </p>
      </div>
    </main>
  );
}
