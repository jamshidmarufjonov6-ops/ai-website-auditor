"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useI18n } from "@/i18n";

type FormState = "idle" | "sending" | "sent" | "error";

export default function ContactPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setEmail(u.email);
      })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await api.contact({ name, email, subject, message });
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : t("contactErrorGeneric"));
    }
  };

  return (
    <main className="relative overflow-hidden">
      <div className="aurora-bg" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-64 grid-bg" aria-hidden="true" />

      <div className="container-page relative py-16 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <p className="eyebrow">{t("contactEyebrow")}</p>
            <h1 className="section-title mt-4">{t("contactTitle")}</h1>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("contactSubtitle")}</p>
          </div>

          {state === "sent" ? (
            <div className="glass mt-10 p-10 text-center">
              <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-glow-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="h-8 w-8">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </span>
              <h2 className="mt-6 text-xl font-bold">{t("contactSentTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{t("contactSentText")}</p>
              <Link href="/" className="btn-primary mt-8">{t("contactBackHome")}</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="glass mt-10 space-y-5 p-6 sm:p-8">
              {user ? (
                <p className="rounded-xl border border-accent-500/25 bg-accent-500/10 px-4 py-3 text-sm text-accent-700 dark:text-accent-300">
                  {t("contactLoggedInAs")} <strong>{user.email}</strong>
                </p>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="label">{t("contactName")}</label>
                  <input
                    id="name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("contactNamePlaceholder")}
                    maxLength={120}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="label">{t("contactEmail")}</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("contactEmailPlaceholder")}
                    maxLength={320}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="label">{t("contactSubject")}</label>
                <input
                  id="subject"
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("contactSubjectPlaceholder")}
                  maxLength={200}
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="label">
                  {t("contactMessage")}
                  <span className="ml-2 font-normal normal-case tracking-normal text-ink-400">
                    {message.length}/5000
                  </span>
                </label>
                <textarea
                  id="message"
                  className="input min-h-[160px] resize-y"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("contactMessagePlaceholder")}
                  minLength={10}
                  maxLength={5000}
                  required
                />
              </div>

              {state === "error" ? (
                <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={state === "sending"} className="btn-primary w-full !py-3.5">
                {state === "sending" ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
                    </svg>
                    {t("contactSending")}
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="m22 2-7 20-4-9-9-4 20-7Z" strokeLinejoin="round" />
                    </svg>
                    {t("contactSend")}
                  </>
                )}
              </button>

              <p className="text-center text-xs leading-relaxed text-ink-400 dark:text-ink-500">
                {t("contactPrivacyNote")}
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
