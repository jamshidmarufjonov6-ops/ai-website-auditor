"use client";

import Link from "next/link";
import { UrlForm } from "@/components/UrlForm";
import { useI18n } from "@/i18n";

export default function Home() {
  const { t } = useI18n();

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-200/70 dark:border-ink-800">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-brand-500/10 to-transparent"
        />
        <div className="container-page relative py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="badge border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900 dark:bg-brand-950/60 dark:text-brand-300">
              {t("heroBadge")}
            </p>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-5 text-lg text-ink-600 dark:text-ink-300">
              {t("heroSubtitle")}
            </p>
            <div className="mx-auto mt-9 max-w-xl">
              <UrlForm ctaLabel={t("heroCta")} />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#how-it-works" className="btn-secondary">
                {t("heroSeeHow")}
              </a>
              <a href="#features" className="text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                {t("heroExplore")} →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">{t("howTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("howSubtitle")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: "01", title: t("howStep1Title"), text: t("howStep1Text") },
              { n: "02", title: t("howStep2Title"), text: t("howStep2Text") },
              { n: "03", title: t("howStep3Title"), text: t("howStep3Text") },
            ].map((step) => (
              <div key={step.n} className="card p-6">
                <p className="text-3xl font-extrabold text-brand-200 dark:text-brand-800">{step.n}</p>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we check */}
      <section id="features" className="border-t border-ink-200/70 py-16 dark:border-ink-800">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">{t("featuresTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("featuresSubtitle")}</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: t("featureSeo"), text: t("featureSeoText") },
              { title: t("featurePerf"), text: t("featurePerfText") },
              { title: t("featureSecurity"), text: t("featureSecurityText") },
              { title: t("featureA11y"), text: t("featureA11yText") },
              { title: t("featureMobile"), text: t("featureMobileText") },
              { title: t("featureTech"), text: t("featureTechText") },
            ].map((f) => (
              <div key={f.title} className="card p-6">
                <h3 className="text-lg font-semibold text-brand-700 dark:text-brand-400">{f.title}</h3>
                <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example report explanation */}
      <section id="example-report" className="border-t border-ink-200/70 py-16 dark:border-ink-800">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">{t("exampleTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("exampleSubtitle")}</p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl">
            <div className="card overflow-hidden">
              <div className="flex flex-col items-center justify-between gap-4 border-b border-ink-200 bg-ink-50/50 p-6 dark:border-ink-800 dark:bg-ink-800/40 sm:flex-row">
                <div>
                  <p className="font-semibold">{t("exampleOverall")}</p>
                  <p className="text-sm text-ink-500 dark:text-ink-400">{t("exampleIllustrative")}</p>
                </div>
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-yellow-400 text-2xl font-extrabold">
                  74
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3">
                {[
                  { label: t("featureSeo"), score: 82 },
                  { label: t("featurePerf"), score: 69 },
                  { label: t("featureSecurity"), score: 61 },
                  { label: t("featureA11y"), score: 88 },
                  { label: t("featureMobile"), score: 91 },
                  { label: t("featureTech"), score: 72 },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-xl font-extrabold tabular-nums">{item.score}<span className="text-xs font-semibold text-ink-400">/100</span></p>
                  </div>
                ))}
              </div>
              <div className="border-t border-ink-200 p-6 dark:border-ink-800">
                <p className="text-sm font-semibold">{t("exampleIssuesTitle")}</p>
                <ul className="mt-2 space-y-2 text-sm text-ink-600 dark:text-ink-300">
                  <li><span className="badge bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">{t("exampleCritical")}</span> HTTPS</li>
                  <li><span className="badge bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300">{t("exampleWarning")}</span> Meta description</li>
                  <li><span className="badge bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">{t("examplePassed")}</span> Viewport</li>
                </ul>
                <p className="mt-3 text-xs text-ink-400">{t("exampleExplained")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Honest limitations */}
      <section className="border-t border-ink-200/70 py-16 dark:border-ink-800">
        <div className="container-page mx-auto max-w-3xl">
          <div className="card p-8">
            <h2 className="text-xl font-bold">{t("limitationsTitle")}</h2>
            <ul className="mt-4 space-y-3 text-sm text-ink-600 dark:text-ink-300">
              <li>• {t("limitationsItem1")}</li>
              <li>• {t("limitationsItem2")}</li>
              <li>• {t("limitationsItem3")}</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-ink-200/70 py-16 dark:border-ink-800">
        <div className="container-page mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">{t("faqTitle")}</h2>
          <div className="mt-10 space-y-3">
            {[
              { q: t("faqQ1"), a: t("faqA1") },
              { q: t("faqQ2"), a: t("faqA2") },
              { q: t("faqQ3"), a: t("faqA3") },
              { q: t("faqQ4"), a: t("faqA4") },
              { q: t("faqQ5"), a: t("faqA5") },
            ].map((faq) => (
              <details key={faq.q} className="card p-5">
                <summary className="cursor-pointer list-none font-semibold">{faq.q}</summary>
                <p className="mt-3 text-sm text-ink-600 dark:text-ink-300">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ink-200/70 py-16 dark:border-ink-800">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="mt-3 text-ink-600 dark:text-ink-300">{t("ctaSubtitle")}</p>
            <div className="mx-auto mt-8 max-w-xl">
              <UrlForm ctaLabel={t("ctaButton")} />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200/70 py-8 dark:border-ink-800">
        <div className="container-page flex flex-col items-center justify-between gap-3 text-sm text-ink-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AI Website Auditor. {t("footerCopyright")}</p>
          <p className="text-xs">{t("footerAudience")}</p>
        </div>
      </footer>
    </main>
  );
}
