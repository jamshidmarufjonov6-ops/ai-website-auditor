"use client";

import Link from "next/link";
import { UrlForm } from "@/components/UrlForm";
import { useI18n } from "@/i18n";

/* ---------- Decorative SVG icons for feature cards ---------- */

const ICONS: Record<string, React.ReactNode> = {
  seo: (
    <path d="M11 4a7 7 0 1 0 4.9 12l4 4 1.4-1.4-4-4A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
  ),
  perf: <path d="M12 3a9 9 0 0 0-6.36 15.36l1.42-1.42A7 7 0 1 1 19 12h2a9 9 0 0 0-9-9Zm-.7 6.3L8 14l4.7 1.7L16.7 6l-5.4 3.3Z" />,
  security: <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 2.2 6 2.2V11c0 4.1-2.6 8-6 9.8C8.6 19 6 15.1 6 11V6.4l6-2.2Z" />,
  a11y: <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-9 6h18v2h-7v12h-2v-5h-2v5H8V10H3V8Z" />,
  mobile: <path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 2v14h8V4H8Zm4 15a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />,
  tech: <path d="m8 8-4 4 4 4 1.4-1.4L6.8 12l2.6-2.6L8 8Zm8 0-1.4 1.4 2.6 2.6-2.6 2.6L16 16l4-4-4-4Zm-3.2-3-3 12 1.9.5 3-12-1.9-.5Z" />,
};

function FeatureIcon({ name }: { name: string }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500/15 via-brand-500/15 to-cyan-400/15 ring-1 ring-inset ring-accent-500/25 dark:from-accent-500/20 dark:via-brand-500/20 dark:to-cyan-400/10">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-accent-600 dark:text-accent-300">
        {ICONS[name]}
      </svg>
    </span>
  );
}

/* ---------- Static score ring used in the report mockup ---------- */

function MockScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 34;
  const offset = circumference * (1 - score / 100);
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="7" className="text-white/10 dark:text-white/[0.07]" />
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold tabular-nums">
        {score}
      </div>
    </div>
  );
}

const CATEGORY_BARS = [
  { key: "featureSeo", score: 82 },
  { key: "featurePerf", score: 69 },
  { key: "featureSecurity", score: 61 },
  { key: "featureA11y", score: 88 },
  { key: "featureMobile", score: 91 },
  { key: "featureTech", score: 72 },
];

function barColor(score: number): string {
  if (score >= 80) return "from-emerald-400 to-emerald-300";
  if (score >= 60) return "from-amber-400 to-yellow-300";
  return "from-red-400 to-orange-300";
}

export default function Home() {
  const { t } = useI18n();

  const features = [
    { icon: "seo", title: t("featureSeo"), text: t("featureSeoText") },
    { icon: "perf", title: t("featurePerf"), text: t("featurePerfText") },
    { icon: "security", title: t("featureSecurity"), text: t("featureSecurityText") },
    { icon: "a11y", title: t("featureA11y"), text: t("featureA11yText") },
    { icon: "mobile", title: t("featureMobile"), text: t("featureMobileText") },
    { icon: "tech", title: t("featureTech"), text: t("featureTechText") },
  ];

  const steps = [
    { n: "01", title: t("howStep1Title"), text: t("howStep1Text") },
    { n: "02", title: t("howStep2Title"), text: t("howStep2Text") },
    { n: "03", title: t("howStep3Title"), text: t("howStep3Text") },
  ];

  return (
    <main className="overflow-x-clip">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-ink-200/60 dark:border-white/[0.06]">
        <div className="aurora-bg" aria-hidden="true" />
        <div className="absolute inset-0 grid-bg" aria-hidden="true" />

        <div className="container-page relative py-24 sm:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <p className="eyebrow animate-fade-up">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
              </span>
              {t("heroBadge")}
            </p>

            <h1 className="mt-6 animate-fade-up-delay-1 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              {t("heroTitle")}
              <br />
              <span className="text-gradient">{t("heroTitleAccent")}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl animate-fade-up-delay-2 text-lg leading-relaxed text-ink-600 dark:text-ink-300 sm:text-xl">
              {t("heroSubtitle")}
            </p>

            {/* URL form in a glowing gradient frame */}
            <div className="glow-border mx-auto mt-10 max-w-2xl animate-fade-up-delay-3 shadow-glow-lg">
              <div className="rounded-[calc(1.25rem-1px)] bg-white/95 p-5 backdrop-blur-xl dark:bg-ink-900/85 sm:p-6">
                <UrlForm ctaLabel={t("heroCta")} />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-500 dark:text-ink-400 animate-fade-up-delay-3">
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-emerald-500"><path d="M10 1.7 3.3 4.5v5c0 4 2.9 7.8 6.7 8.8 3.8-1 6.7-4.8 6.7-8.8v-5L10 1.7Zm3.4 6-4.3 5.2-2.5-2.6 1.2-1.1 1.4 1.4 3.1-3.9 1.1 1Z" /></svg>
                {t("heroTrustNoSignup")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-accent-500"><path d="M10 2a4 4 0 0 1 4 4v2h1a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1V6a4 4 0 0 1 4-4Zm0 2a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2Z" /></svg>
                {t("heroTrustPrivate")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-cyan-500"><path d="M10 2c3 2.5 6 3.5 8 3.5 0 6.5-3.2 10.6-8 12.5C5.2 16.1 2 12 2 5.5 4 5.5 7 4.5 10 2Zm3 5-4.5 4.5L6 9l-1 1 3.5 4L13 8Z" /></svg>
                {t("heroTrustRealChecks")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS STRIP ================= */}
      <section className="border-b border-ink-200/60 bg-white/50 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="container-page grid grid-cols-2 gap-6 py-10 sm:grid-cols-4">
          {[
            { value: "60+", label: t("statChecks") },
            { value: "6", label: t("statCategories") },
            { value: "0–100", label: t("statTransparentScore") },
            { value: "3", label: t("statLanguages") },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="bg-gradient-to-r from-accent-500 to-cyan-400 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-ink-500 dark:text-ink-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">{t("navHowItWorks")}</p>
            <h2 className="section-title mt-4">{t("howTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("howSubtitle")}</p>
          </div>

          <div className="relative mt-14 grid gap-6 md:grid-cols-3">
            {/* connector line (desktop) */}
            <div aria-hidden="true" className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-accent-500/40 via-brand-500/40 to-cyan-400/40 md:block" />
            {steps.map((step) => (
              <div key={step.n} className="card card-hover relative p-7 text-center md:text-left">
                <p className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-600 via-brand-600 to-cyan-500 text-lg font-extrabold text-white shadow-glow-sm">
                  {step.n}
                </p>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="border-t border-ink-200/60 py-20 dark:border-white/[0.06] sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">{t("featuresEyebrow")}</p>
            <h2 className="section-title mt-4">{t("featuresTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("featuresSubtitle")}</p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card card-hover p-7">
                <FeatureIcon name={f.icon} />
                <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= REPORT PREVIEW ================= */}
      <section id="example-report" className="border-t border-ink-200/60 py-20 dark:border-white/[0.06] sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">{t("exampleEyebrow")}</p>
            <h2 className="section-title mt-4">{t("exampleTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("exampleSubtitle")}</p>
          </div>

          <div className="glow-border mx-auto mt-14 max-w-4xl">
            <div className="overflow-hidden rounded-[calc(1.25rem-1px)] bg-white dark:bg-ink-900/90">
              {/* fake window chrome */}
              <div className="flex items-center gap-2 border-b border-ink-200/70 px-5 py-3.5 dark:border-white/[0.07]">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <span className="ml-4 hidden rounded-md bg-ink-100 px-3 py-1 text-xs text-ink-500 dark:bg-white/[0.06] dark:text-ink-400 sm:block">
                  https://example.com — audit report
                </span>
              </div>

              <div className="flex flex-col items-center justify-between gap-6 border-b border-ink-200/70 bg-gradient-to-r from-accent-50/60 to-cyan-50/40 p-8 dark:border-white/[0.07] dark:from-transparent dark:to-transparent sm:flex-row">
                <div>
                  <p className="font-semibold">{t("exampleOverall")}</p>
                  <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{t("exampleIllustrative")}</p>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    <li><span className="badge bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">{t("exampleCritical")}</span> HTTPS</li>
                    <li><span className="badge bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300">{t("exampleWarning")}</span> Meta description</li>
                    <li><span className="badge bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">{t("examplePassed")}</span> Viewport</li>
                  </ul>
                </div>
                <MockScoreRing score={74} />
              </div>

              <div className="grid gap-x-8 gap-y-5 p-8 sm:grid-cols-2">
                {CATEGORY_BARS.map((item) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{t(item.key)}</span>
                      <span className="font-bold tabular-nums">{item.score}<span className="ml-0.5 text-xs font-semibold text-ink-400">/100</span></span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-white/[0.07]">
                      <div className={`h-full rounded-full bg-gradient-to-r ${barColor(item.score)}`} style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-ink-200/70 px-8 py-5 dark:border-white/[0.07]">
                <p className="text-xs text-ink-400">{t("exampleExplained")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRANSPARENCY / LIMITATIONS ================= */}
      <section className="border-t border-ink-200/60 py-20 dark:border-white/[0.06] sm:py-24">
        <div className="container-page mx-auto max-w-3xl">
          <div className="glass p-8 sm:p-10">
            <h2 className="flex items-center gap-3 text-xl font-bold">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg>
              </span>
              {t("limitationsTitle")}
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              <li>• {t("limitationsItem1")}</li>
              <li>• {t("limitationsItem2")}</li>
              <li>• {t("limitationsItem3")}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="border-t border-ink-200/60 py-20 dark:border-white/[0.06] sm:py-24">
        <div className="container-page mx-auto max-w-3xl">
          <h2 className="section-title text-center">{t("faqTitle")}</h2>
          <div className="mt-10 space-y-3">
            {[
              { q: t("faqQ1"), a: t("faqA1") },
              { q: t("faqQ2"), a: t("faqA2") },
              { q: t("faqQ3"), a: t("faqA3") },
              { q: t("faqQ4"), a: t("faqA4") },
              { q: t("faqQ5"), a: t("faqA5") },
            ].map((faq) => (
              <details key={faq.q} className="card group p-5 transition-colors open:border-accent-400/40 dark:open:border-accent-500/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-300 group-open:rotate-45">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="border-t border-ink-200/60 py-20 dark:border-white/[0.06] sm:py-28">
        <div className="container-page">
          <div className="glow-border mx-auto max-w-3xl shadow-glow">
            <div className="rounded-[calc(1.25rem-1px)] bg-gradient-to-b from-white to-accent-50/50 px-6 py-12 text-center dark:from-ink-900/90 dark:to-ink-900/60 sm:px-12">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("ctaTitle")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-ink-600 dark:text-ink-300">{t("ctaSubtitle")}</p>
              <div className="mx-auto mt-8 max-w-xl">
                <UrlForm ctaLabel={t("ctaButton")} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-ink-200/60 py-12 dark:border-white/[0.06]">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent-500 via-brand-500 to-cyan-400">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
                    <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 3.5A5.5 5.5 0 0 1 17.5 12l-5.5 3V6.5Z" fill="currentColor" />
                    <circle cx="12" cy="12" r="2.5" fill="#fff" />
                  </svg>
                </span>
                <span className="text-sm font-bold">{t("appName")}</span>
              </div>
              <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">{t("footerTagline")}</p>
            </div>

            <div className="grid grid-cols-2 gap-12 text-sm sm:gap-20">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("footerProduct")}</p>
                <ul className="mt-3 space-y-2">
                  <li><Link href="/#features" className="text-ink-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-accent-300">{t("navFeatures")}</Link></li>
                  <li><Link href="/#how-it-works" className="text-ink-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-accent-300">{t("navHowItWorks")}</Link></li>
                  <li><Link href="/#faq" className="text-ink-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-accent-300">FAQ</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("footerSupport")}</p>
                <ul className="mt-3 space-y-2">
                  <li><Link href="/contact" className="text-ink-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-accent-300">{t("navContact")}</Link></li>
                  <li><Link href="/login" className="text-ink-600 hover:text-brand-600 dark:text-ink-300 dark:hover:text-accent-300">{t("navLogin")}</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-ink-200/60 pt-6 text-sm text-ink-500 dark:border-white/[0.06] dark:text-ink-400 sm:flex-row">
            <p>© {new Date().getFullYear()} AI Website Auditor. {t("footerCopyright")}</p>
            <p className="text-xs">{t("footerAudience")}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
