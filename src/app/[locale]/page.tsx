import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Users, Search, Wand2 } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { CASE_STUDIES } from "@/content/case-studies";
import { FAQ_GLOBAL } from "@/content/transversal";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface HomeProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/",
    title: isFr
      ? "Cabinet IA opérationnel · ROI 90 jours · AxionIA"
      : "Operational AI consultancy · 90-day ROI · AxionIA",
    description: isFr
      ? "Interventions IA en entreprise, audits chiffrés et implémentations pour PME et ETI. Hébergement UE, OÜ estonienne, à partir de 490 €."
      : "On-site AI sessions, costed audits and implementation for SMEs and mid-market firms. EU hosting, Estonian OÜ, from €490.",
    alternates: { fr: "/", en: "/" },
  });
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations("home");

  // 3 services — intervenir / auditer / implémenter (cœur du message client).
  const valuePropositions = [
    {
      id: "intervene",
      icon: Users,
      action: t("value1Action"),
      headline: t("value1Headline"),
      price: t("value1Price"),
      bullets: [t("value1Bullet1"), t("value1Bullet2"), t("value1Bullet3")],
      gain: t("value1Gain"),
      href: "/interventions" as const,
    },
    {
      id: "audit",
      icon: Search,
      action: t("value2Action"),
      headline: t("value2Headline"),
      price: t("value2Price"),
      bullets: [t("value2Bullet1"), t("value2Bullet2"), t("value2Bullet3")],
      gain: t("value2Gain"),
      href: "/audit" as const,
    },
    {
      id: "implement",
      icon: Wand2,
      action: t("value3Action"),
      headline: t("value3Headline"),
      price: t("value3Price"),
      bullets: [t("value3Bullet1"), t("value3Bullet2"), t("value3Bullet3")],
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
  ];

  const whyPoints = [t("valueWhy1"), t("valueWhy2"), t("valueWhy3"), t("valueWhy4")];

  // Métriques.
  const metrics = [
    { id: "roi", number: t("metric1Number"), suffix: t("metric1Suffix"), label: t("metric1Label") },
    { id: "eu", number: t("metric2Number"), suffix: t("metric2Suffix"), label: t("metric2Label") },
    {
      id: "ticket",
      number: t("metric3Number"),
      suffix: t("metric3Suffix"),
      label: t("metric3Label"),
    },
    {
      id: "lockin",
      number: t("metric4Number"),
      suffix: t("metric4Suffix"),
      label: t("metric4Label"),
    },
  ];

  // 4 étapes méthode.
  const methodSteps = [
    { id: "scope", n: "01", title: t("method1Title"), description: t("method1Description") },
    { id: "demo", n: "02", title: t("method2Title"), description: t("method2Description") },
    { id: "plan", n: "03", title: t("method3Title"), description: t("method3Description") },
    { id: "golive", n: "04", title: t("method4Title"), description: t("method4Description") },
  ];

  // 3 cas concrets.
  const featuredCases = CASE_STUDIES.slice(0, 3).map((c) => ({
    slug: c.slug,
    industry: isFr ? c.industry : c.industryEn,
    metric: c.metric,
    title: c[loc].title,
    excerpt: c[loc].excerpt,
  }));

  // FAQ.
  const faqs = FAQ_GLOBAL.map((f) => ({
    id: f.id,
    question: f[loc].question,
    answer: f[loc].answer,
  }));

  // JSON-LD.
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AxionIA",
    legalName: "AxionIA OÜ",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    foundingDate: "2024",
    address: {
      "@type": "PostalAddress",
      addressCountry: "EE",
      addressLocality: "Tallinn",
    },
  } as const;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } as const;

  return (
    <>
      {/* ───────────── HERO ───────────── */}
      <section className="bg-halo-warm relative overflow-hidden py-24 sm:py-32 lg:py-40">
        {/* Visuel SVG abstrait éditorial à droite, masqué mobile */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-0 hidden -translate-y-1/2 lg:block"
        >
          <svg
            width="520"
            height="520"
            viewBox="0 0 520 520"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-40"
          >
            <circle cx="260" cy="260" r="240" stroke="currentColor" strokeOpacity="0.08" />
            <circle cx="260" cy="260" r="180" stroke="currentColor" strokeOpacity="0.12" />
            <circle cx="260" cy="260" r="120" stroke="currentColor" strokeOpacity="0.15" />
            <circle cx="260" cy="260" r="60" stroke="currentColor" strokeOpacity="0.2" />
            <circle cx="260" cy="60" r="6" fill="var(--color-terracotta)" />
            <circle cx="460" cy="260" r="6" fill="var(--color-primary)" />
            <circle cx="380" cy="380" r="4" fill="var(--color-sage)" />
            <circle cx="140" cy="320" r="4" fill="var(--color-terracotta)" />
            <line
              x1="260"
              y1="60"
              x2="260"
              y2="200"
              stroke="var(--color-terracotta)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <line
              x1="460"
              y1="260"
              x2="320"
              y2="260"
              stroke="var(--color-primary)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
          </svg>
        </div>

        <Container className="relative">
          <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
            <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
            {t("heroEyebrow")}
          </p>
          <h1 className="text-display-editorial text-fg max-w-5xl">
            {t("heroTitlePart1")}{" "}
            <em className="italic-editorial text-terracotta not-italic">
              <span className="italic">{t("heroTitleEm")}</span>
            </em>
            {t("heroTitlePart2")}
          </h1>
          <p className="text-fg-soft mt-10 max-w-2xl text-lg leading-relaxed sm:text-xl">
            {t("heroDescription")}
          </p>
          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              href="/interventions/essentielle"
              className="bg-primary text-primary-fg cta-lift focus-visible:ring-primary inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("heroCtaPrimary")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/cas-concrets"
              className="text-fg border-border-strong cta-lift bg-paper/60 focus-visible:ring-primary inline-flex h-14 items-center gap-2 rounded-full border px-7 text-base font-semibold backdrop-blur focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {t("heroCtaSecondary")}
            </Link>
          </div>
        </Container>
      </section>

      {/* ───────────── VALUE PROPOSITION (3 services + bénéfice client) ───────────── */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("valueEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("valueTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("valueTitleEm")}
                </span>
                {t("valueTitlePart2")}
              </h2>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
                {t("valueDescription")}
              </p>
            </div>
          </FadeInOnView>

          <ul className="grid gap-6 lg:grid-cols-3">
            {valuePropositions.map((v, idx) => {
              const Icon = v.icon;
              return (
                <FadeInOnView key={v.id} delay={idx * 80}>
                  <li>
                    <Link
                      href={v.href}
                      className="group bg-bg border-border hover:border-terracotta focus-visible:ring-primary flex h-full flex-col gap-6 rounded-2xl border p-8 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <div className="flex items-center justify-between">
                        <span className="bg-terracotta-soft text-terracotta-deep inline-flex h-12 w-12 items-center justify-center rounded-full">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="text-fg-muted font-mono text-xs tracking-wider">
                          0{idx + 1}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                          {v.action}
                        </h3>
                        <p
                          className="text-terracotta mt-2 text-base italic"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {v.headline}
                        </p>
                      </div>
                      <ul className="flex flex-1 flex-col gap-3">
                        {v.bullets.map((b, i) => (
                          <li
                            key={i}
                            className="text-fg-soft flex items-start gap-3 text-sm leading-relaxed"
                          >
                            <Check
                              className="text-sage mt-0.5 h-4 w-4 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="border-border space-y-3 border-t pt-5">
                        <p className="text-terracotta-deep text-sm font-semibold">{v.gain}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-fg-muted text-xs">{v.price}</span>
                          <span className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
                            {isFr ? "Voir le détail" : "See details"}
                            <ArrowRight
                              className="h-4 w-4 transition group-hover:translate-x-1"
                              aria-hidden="true"
                            />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                </FadeInOnView>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ───────────── WHY YOU CAN ONLY WIN ───────────── */}
      <section className="bg-halo-cool py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <p className="text-fg-muted mb-10 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              {t("valueWhyEyebrow")}
            </p>
            <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {whyPoints.map((point, idx) => (
                <li key={idx} className="text-fg flex items-start gap-4">
                  <span
                    className="text-terracotta text-2xl font-medium tabular-nums"
                    style={{ fontFamily: "var(--font-serif)" }}
                    aria-hidden="true"
                  >
                    0{idx + 1}
                  </span>
                  <span className="text-base leading-relaxed sm:text-lg">{point}</span>
                </li>
              ))}
            </ul>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── METRICS (mocha riche) ───────────── */}
      <section className="bg-mocha-rich text-mocha-fg relative overflow-hidden py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("metricsEyebrow")}
              </p>
              <h2 className="text-mocha-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("metricsTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta-soft"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("metricsTitleEm")}
                </span>
                {t("metricsTitlePart2")}
              </h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
              {metrics.map((m) => (
                <div key={m.id} className="flex flex-col gap-3">
                  <dt className="text-mocha-fg/70 order-2 text-sm leading-snug">{m.label}</dt>
                  <dd
                    className="text-mocha-fg order-1 [font-feature-settings:'tnum'] text-[clamp(3.5rem,7vw,6rem)] leading-[0.95] font-medium tracking-[-0.04em]"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {m.number}
                    {m.suffix ? (
                      <span className="text-terracotta-soft ml-1 text-2xl font-medium">
                        {m.suffix}
                      </span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── METHOD ───────────── */}
      <section className="bg-bg py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("methodEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("methodTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("methodTitleEm")}
                </span>
                {t("methodTitlePart2")}
              </h2>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
                {t("methodDescription")}
              </p>
            </div>
          </FadeInOnView>
          <ol className="grid gap-12 lg:grid-cols-4">
            {methodSteps.map((step, idx) => (
              <FadeInOnView key={step.id} delay={idx * 60}>
                <li className="border-border-strong flex flex-col gap-4 border-t pt-6">
                  <span
                    className="text-terracotta text-2xl font-medium tabular-nums"
                    style={{ fontFamily: "var(--font-serif)" }}
                    aria-hidden="true"
                  >
                    {step.n}
                  </span>
                  <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-fg-soft text-base leading-relaxed">{step.description}</p>
                </li>
              </FadeInOnView>
            ))}
          </ol>
        </Container>
      </section>

      {/* ───────────── CASES ───────────── */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("casesEyebrow")}
                </p>
                <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                  {t("casesTitlePart1")}{" "}
                  <span
                    className="italic-editorial text-terracotta"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t("casesTitleEm")}
                  </span>
                  {t("casesTitlePart2")}
                </h2>
                <p className="text-fg-soft mt-6 text-lg leading-relaxed">{t("casesDescription")}</p>
              </div>
              <Link
                href="/cas-concrets"
                className="text-primary inline-flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                {t("casesCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </FadeInOnView>
          <ul className="grid gap-6 lg:grid-cols-3">
            {featuredCases.map((c, idx) => (
              <FadeInOnView key={c.slug} delay={idx * 80}>
                <li>
                  <Link
                    href={`/cas-concrets/${c.slug}` as never}
                    className="group bg-bg border-border hover:border-border-strong focus-visible:ring-primary flex h-full flex-col gap-6 rounded-2xl border p-8 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-sand text-fg-soft inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                        {c.industry}
                      </span>
                      <span className="bg-terracotta-soft text-terracotta-deep inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                        {c.metric}
                      </span>
                    </div>
                    <h3
                      className="text-fg text-2xl leading-[1.2] font-medium tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {c.title}
                    </h3>
                    <p className="text-fg-soft flex-1 text-base leading-relaxed">{c.excerpt}</p>
                    <span className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
                      {isFr ? "Lire le cas" : "Read the case"}
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              </FadeInOnView>
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── ROI ───────────── */}
      <section className="bg-sand py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <div className="border-border-strong bg-paper flex flex-col gap-8 rounded-3xl border p-10 lg:flex-row lg:items-center lg:justify-between lg:p-14">
              <div className="max-w-xl">
                <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("roiEyebrow")}
                </p>
                <h2 className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight">
                  {t("roiTitlePart1")}{" "}
                  <span
                    className="italic-editorial text-terracotta"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t("roiTitleEm")}
                  </span>
                  {t("roiTitlePart2")}
                </h2>
                <p className="text-fg-soft mt-5 text-base leading-relaxed">{t("roiDescription")}</p>
              </div>
              <Link
                href="/roi"
                className="bg-primary text-primary-fg cta-lift focus-visible:ring-primary inline-flex h-14 shrink-0 items-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("roiCta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── TESTIMONIALS ───────────── */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("testimonialsEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("testimonialsTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("testimonialsTitleEm")}
                </span>
                {t("testimonialsTitlePart2")}
              </h2>
            </div>
          </FadeInOnView>
          <ul className="grid gap-12 lg:grid-cols-2">
            {CASE_STUDIES.slice(0, 4).map((c, idx) => (
              <FadeInOnView key={c.slug} delay={idx * 80}>
                <li className="border-border-strong flex flex-col gap-6 border-t pt-8">
                  <span
                    aria-hidden="true"
                    className="text-terracotta text-6xl leading-none"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    &ldquo;
                  </span>
                  <blockquote
                    className="text-fg text-xl leading-[1.4] font-medium"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {c[loc].testimonialQuote}
                  </blockquote>
                  <footer className="text-fg-soft text-sm">
                    <span className="text-fg font-semibold">{c[loc].testimonialAuthor}</span>
                    <span className="mx-2">·</span>
                    <span>{c[loc].testimonialRole}</span>
                    <span className="mx-2">·</span>
                    <span>{isFr ? c.industry : c.industryEn}</span>
                  </footer>
                </li>
              </FadeInOnView>
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── FAQ ───────────── */}
      <section className="bg-bg py-24 sm:py-28 lg:py-36">
        <Container className="max-w-3xl">
          <FadeInOnView>
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              FAQ
            </p>
            <h2 className="text-fg text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight">
              {t("faqTitle")}
            </h2>
            <p className="text-fg-soft mt-4 text-base leading-relaxed">{t("faqDescription")}</p>
            <div className="mt-12">
              <Accordion type="single" collapsible>
                {faqs.map((f) => (
                  <AccordionItem key={f.id} value={f.id}>
                    <AccordionTrigger>{f.question}</AccordionTrigger>
                    <AccordionContent>{f.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── CTA FINAL ───────────── */}
      <section className="bg-mocha-rich text-mocha-fg relative overflow-hidden py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="max-w-3xl">
            <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              {t("ctaBlockEyebrow")}
            </p>
            <h2 className="text-mocha-fg text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] font-semibold tracking-tight">
              {t("ctaBlockTitlePart1")}{" "}
              <span
                className="text-terracotta-soft italic"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {t("ctaBlockTitleEm")}
              </span>
              {t("ctaBlockTitlePart2")}
            </h2>
            <p className="text-mocha-fg/85 mt-6 max-w-2xl text-lg leading-relaxed">
              {t("ctaBlockDescription")}
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="/interventions/essentielle"
                className="bg-paper text-fg cta-lift focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("ctaBlockPrimary")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="text-mocha-fg border-border-on-mocha cta-lift focus-visible:ring-terracotta focus-visible:ring-offset-mocha inline-flex h-14 items-center gap-2 rounded-full border px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {t("ctaBlockSecondary")}
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <JsonLd data={orgJsonLd} />
      <JsonLd data={faqJsonLd} />
    </>
  );
}
