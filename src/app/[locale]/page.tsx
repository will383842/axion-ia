import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Users,
  Search,
  Wand2,
  ShieldCheck,
  Building2,
  Lock,
  Target,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Link } from "@/i18n/navigation";
import { CASE_STUDIES } from "@/content/case-studies";
import { FAQ_GLOBAL } from "@/content/transversal";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
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
      ? "Interventions IA sur site, audits chiffrés et implémentations pour PME et ETI. Hébergement UE, OÜ estonienne, à partir de 490 €."
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

  // 3 modules.
  const modules = [
    {
      id: "interventions",
      icon: Users,
      title: t("module1Title"),
      description: t("module1Description"),
      href: "/interventions" as const,
      cta: t("module1Cta"),
      number: "01",
    },
    {
      id: "audit",
      icon: Search,
      title: t("module2Title"),
      description: t("module2Description"),
      href: "/audit" as const,
      cta: t("module2Cta"),
      number: "02",
    },
    {
      id: "implementation",
      icon: Wand2,
      title: t("module3Title"),
      description: t("module3Description"),
      href: "/implementation" as const,
      cta: t("module3Cta"),
      number: "03",
    },
  ];

  // Trust points.
  const trustPoints = [
    { id: "eu", icon: ShieldCheck, label: t("trust1") },
    { id: "ou", icon: Building2, label: t("trust2") },
    { id: "rgpd", icon: Lock, label: t("trust3") },
    { id: "roi", icon: Target, label: t("trust4") },
  ];

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
        <Container>
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

      {/* ───────────── TRUST STRIP (sand alternance) ───────────── */}
      <section aria-label={t("trustEyebrow")} className="bg-sand border-border border-y py-10">
        <Container>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {trustPoints.map((tp) => {
              const Icon = tp.icon;
              return (
                <li key={tp.id} className="text-fg-soft flex items-center gap-3 text-[13px]">
                  <span className="bg-paper text-fg border-border inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="leading-snug">{tp.label}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ───────────── MODULES (paper white) ───────────── */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="mb-16 max-w-3xl">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              {t("modulesEyebrow")}
            </p>
            <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              {t("modulesTitlePart1")}{" "}
              <span className="italic-editorial text-terracotta">{t("modulesTitleEm")}</span>
              {t("modulesTitlePart2")}
            </h2>
            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
              {t("modulesDescription")}
            </p>
          </div>
          <ul className="grid gap-6 lg:grid-cols-3">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    className="group bg-bg border-border hover:border-border-strong focus-visible:ring-primary flex h-full flex-col gap-6 rounded-2xl border p-8 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="bg-primary-soft text-primary inline-flex h-12 w-12 items-center justify-center rounded-full">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-fg-muted font-mono text-sm tracking-wider">
                        {m.number}
                      </span>
                    </div>
                    <h3 className="text-fg text-2xl leading-tight font-semibold tracking-tight">
                      {m.title}
                    </h3>
                    <p className="text-fg-soft flex-1 text-base leading-relaxed">{m.description}</p>
                    <span className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
                      {m.cta}
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ───────────── METRICS (mocha riche, alternative au noir) ───────────── */}
      <section className="bg-mocha-rich text-mocha-fg relative overflow-hidden py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="mb-16 max-w-3xl">
            <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              {t("metricsEyebrow")}
            </p>
            <h2 className="text-mocha-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              {t("metricsTitlePart1")}{" "}
              <span className="italic-editorial text-terracotta-soft">{t("metricsTitleEm")}</span>
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
        </Container>
      </section>

      {/* ───────────── METHOD (halo cool sand) ───────────── */}
      <section className="bg-halo-cool py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="mb-16 max-w-3xl">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              {t("methodEyebrow")}
            </p>
            <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              {t("methodTitlePart1")}{" "}
              <span className="italic-editorial text-terracotta">{t("methodTitleEm")}</span>
              {t("methodTitlePart2")}
            </h2>
            <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
              {t("methodDescription")}
            </p>
          </div>
          <ol className="grid gap-12 lg:grid-cols-4">
            {methodSteps.map((step) => (
              <li key={step.id} className="border-border-strong flex flex-col gap-4 border-t pt-6">
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
            ))}
          </ol>
        </Container>
      </section>

      {/* ───────────── CASES (paper white) ───────────── */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("casesEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("casesTitlePart1")}{" "}
                <span className="italic-editorial text-terracotta">{t("casesTitleEm")}</span>
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
          <ul className="grid gap-6 lg:grid-cols-3">
            {featuredCases.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/cas-concrets/${c.slug}` as never}
                  className="group bg-bg border-border hover:border-border-strong focus-visible:ring-primary flex h-full flex-col gap-6 rounded-2xl border p-8 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-sand text-fg-soft inline-flex items-center rounded-full px-3 py-1 text-xs font-medium">
                      {c.industry}
                    </span>
                    <span className="text-terracotta bg-terracotta-soft inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                      {c.metric}
                    </span>
                  </div>
                  <h3
                    className="text-fg text-2xl leading-[1.15] font-medium tracking-tight"
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
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── ROI (sand intermission) ───────────── */}
      <section className="bg-sand py-20 sm:py-24 lg:py-28">
        <Container>
          <div className="border-border-strong bg-paper flex flex-col gap-8 rounded-3xl border p-10 lg:flex-row lg:items-center lg:justify-between lg:p-14">
            <div className="max-w-xl">
              <p className="text-fg-muted mb-4 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("roiEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight">
                {t("roiTitlePart1")}{" "}
                <span className="italic-editorial text-terracotta">{t("roiTitleEm")}</span>
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
        </Container>
      </section>

      {/* ───────────── TESTIMONIALS — pull-quote éditorial ───────────── */}
      <section className="bg-paper py-24 sm:py-28 lg:py-36">
        <Container>
          <div className="mb-16 max-w-3xl">
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              {t("testimonialsEyebrow")}
            </p>
            <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
              {t("testimonialsTitlePart1")}{" "}
              <span className="italic-editorial text-terracotta">{t("testimonialsTitleEm")}</span>
              {t("testimonialsTitlePart2")}
            </h2>
          </div>
          <ul className="grid gap-12 lg:grid-cols-2">
            {CASE_STUDIES.slice(0, 4).map((c) => (
              <li key={c.slug} className="border-border-strong flex flex-col gap-6 border-t pt-8">
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
            ))}
          </ul>
        </Container>
      </section>

      {/* ───────────── FAQ (canvas ivoire) ───────────── */}
      <section className="bg-bg py-24 sm:py-28 lg:py-36">
        <Container className="max-w-3xl">
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
        </Container>
      </section>

      {/* ───────────── CTA FINAL — Mocha rich ───────────── */}
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
            <p className="text-mocha-fg/80 mt-6 max-w-2xl text-lg leading-relaxed">
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
