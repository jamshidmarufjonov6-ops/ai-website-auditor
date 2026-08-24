"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AdminMessagesResponse, Message, User } from "@/lib/types";
import { useI18n } from "@/i18n";

type Filter = "all" | "new" | "read" | "replied";

function StatusBadge({ status }: { status: Message["status"] }) {
  const styles: Record<string, string> = {
    new: "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300",
    read: "bg-ink-100 text-ink-600 dark:bg-white/[0.08] dark:text-ink-300",
    replied: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  };
  return <span className={`badge ${styles[status]}`}>{status}</span>;
}

export default function AdminPage() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<"loading" | "ready">("loading");
  const [data, setData] = useState<AdminMessagesResponse | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setAuthState("ready");
      })
      .catch(() => {
        setUser(null);
        setAuthState("ready");
      });
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api.listAdminMessages());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages.");
    }
  }, []);

  useEffect(() => {
    if (user?.is_admin) void load();
  }, [user, load]);

  if (authState === "loading") {
    return (
      <main className="container-page py-24 text-center text-sm text-ink-400">…</main>
    );
  }

  if (!user) {
    return (
      <main className="container-page py-24">
        <div className="glass mx-auto max-w-md p-10 text-center">
          <h1 className="text-xl font-bold">{t("adminLoginRequired")}</h1>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{t("adminLoginRequiredText")}</p>
          <Link href="/login" className="btn-primary mt-6">{t("navLogin")}</Link>
        </div>
      </main>
    );
  }

  if (!user.is_admin) {
    return (
      <main className="container-page py-24">
        <div className="glass mx-auto max-w-md p-10 text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 text-red-600 dark:text-red-400">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <h1 className="mt-5 text-xl font-bold">{t("adminForbiddenTitle")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{t("adminForbiddenText")}</p>
          <Link href="/" className="btn-secondary mt-6">{t("contactBackHome")}</Link>
        </div>
      </main>
    );
  }

  const setStatus = async (id: string, status: Message["status"]) => {
    setBusyId(id);
    try {
      await api.updateMessageStatus(id, status);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await api.deleteMessage(id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const messages = (data?.messages || []).filter((m) => filter === "all" || m.status === filter);

  return (
    <main className="container-page py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("adminEyebrow")}</p>
          <h1 className="section-title mt-3">{t("adminTitle")}</h1>
          <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
            {t("adminSubtitle")} · <strong>{data?.unread ?? 0}</strong> {t("adminUnreadCount")}
          </p>
        </div>
        <button onClick={() => void load()} className="btn-secondary !px-4 !py-2 !text-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${busyId ? "animate-spin" : ""}`}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
          {t("adminRefresh")}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("statTotal"), value: data?.total ?? 0 },
          { label: t("statUnread"), value: data?.unread ?? 0 },
          {
            label: t("statMailForward"),
            value: data?.mail_configured ? t("statMailOn") : t("statMailOff"),
            highlight: data?.mail_configured,
          },
          { label: t("statAdminEmail"), value: user.email },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{s.label}</p>
            <p className={`mt-1 truncate text-xl font-extrabold ${s.highlight === true ? "text-emerald-500" : s.highlight === false ? "text-amber-500" : ""}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap gap-2">
        {(["all", "new", "read", "replied"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? "btn-primary !px-4 !py-2 !text-xs" : "btn-secondary !px-4 !py-2 !text-xs"}
          >
            {t(`filter_${f}`)}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {/* Messages */}
      <div className="mt-6 space-y-4 pb-16">
        {messages.length === 0 && !error ? (
          <div className="card p-12 text-center text-sm text-ink-500">{t("adminEmpty")}</div>
        ) : null}

        {messages.map((m) => (
          <article key={m.id} className={`card p-6 transition ${m.status === "new" ? "border-accent-400/40 shadow-glow-sm dark:border-accent-500/30" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge status={m.status} />
              {m.email_forwarded ? (
                <span className="badge bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">✉ {t("adminForwarded")}</span>
              ) : m.forward_error ? (
                <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" title={m.forward_error || ""}>✉ {t("adminNotForwarded")}</span>
              ) : null}
              <span className="ml-auto text-xs text-ink-400">
                {new Date(m.created_at).toLocaleString()}
              </span>
            </div>

            <h2 className="mt-3 text-lg font-semibold">{m.subject}</h2>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
              {m.name} · <a href={`mailto:${m.email}`} className="text-brand-600 hover:underline dark:text-accent-300">{m.email}</a>
              {m.user_id ? <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-mono dark:bg-white/[0.07]">{m.user_id.slice(-6)}</span> : null}
            </p>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-ink-200">
              {m.body}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-200/60 pt-4 dark:border-white/[0.06]">
              <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="btn-primary !px-4 !py-2 !text-xs">
                {t("adminReply")}
              </a>
              {m.status !== "read" ? (
                <button disabled={busyId === m.id} onClick={() => void setStatus(m.id, "read")} className="btn-secondary !px-4 !py-2 !text-xs">
                  {t("adminMarkRead")}
                </button>
              ) : null}
              {m.status !== "replied" ? (
                <button disabled={busyId === m.id} onClick={() => void setStatus(m.id, "replied")} className="btn-secondary !px-4 !py-2 !text-xs">
                  {t("adminMarkReplied")}
                </button>
              ) : null}
              <button
                disabled={busyId === m.id}
                onClick={() => void remove(m.id)}
                className="btn-ghost !px-3 !py-2 !text-xs !text-red-600 hover:!bg-red-50 dark:!text-red-400 dark:hover:!bg-red-950/30"
              >
                {t("adminDelete")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
