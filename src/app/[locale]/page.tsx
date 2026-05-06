import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Users, Search, Wand2 } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
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
  // Chaque carte a SA couleur d'accent : terracotta (action humaine) / primary
  // (analyse) / sage (production) — identité visuelle claire par service.
  const valuePropositions = [
    {
      id: "intervene",
      icon: Users,
      accent: "terracotta" as const,
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
      accent: "primary" as const,
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
      accent: "sage" as const,
      action: t("value3Action"),
      headline: t("value3Headline"),
      price: t("value3Price"),
      bullets: [t("value3Bullet1"), t("value3Bullet2"), t("value3Bullet3")],
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
  ];

  // Mapping classes Tailwind pour chaque accent (évite la concaténation
  // dynamique non détectable par le compilateur Tailwind).
  const accentClasses = {
    terracotta: {
      iconBg: "bg-terracotta-soft",
      iconFg: "text-terracotta-deep",
      number: "text-terracotta",
      headline: "text-terracotta",
      hoverBorder: "hover:border-terracotta",
      bulletIcon: "text-terracotta-deep",
      gainBg: "bg-terracotta-soft",
      gainText: "text-terracotta-deep",
      ringHalo: "before:bg-terracotta/8",
    },
    primary: {
      iconBg: "bg-primary-soft",
      iconFg: "text-primary",
      number: "text-primary",
      headline: "text-primary",
      hoverBorder: "hover:border-primary",
      bulletIcon: "text-primary",
      gainBg: "bg-primary-soft",
      gainText: "text-primary",
      ringHalo: "before:bg-primary/8",
    },
    sage: {
      iconBg: "bg-sage-soft",
      iconFg: "text-sage",
      number: "text-sage",
      headline: "text-sage",
      hoverBorder: "hover:border-sage",
      bulletIcon: "text-sage",
      gainBg: "bg-sage-soft",
      gainText: "text-sage",
      ringHalo: "before:bg-sage/8",
    },
  } as const;

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
      <section className="bg-halo-warm relative overflow-hidden py-20 sm:py-24 lg:py-32">
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.55fr_1fr] lg:gap-16 xl:gap-20">
            {/* Colonne gauche : copy (élargie pour casser sur moins de lignes) */}
            <div className="max-w-3xl">
              <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("heroEyebrow")}
              </p>
              <h1 className="text-display-editorial text-fg">
                {t("heroTitlePart1")}{" "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic">{t("heroTitleEm")}</span>
                </em>
                {t("heroTitlePart2")}
              </h1>
              <p className="text-fg-soft mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {t("heroDescription")}
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
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
            </div>

            {/* Colonne droite : illustration narrative enrichie — 3 services
                connectés à votre entreprise avec courbes, sparkline, badges. */}
            <div aria-hidden="true" className="relative hidden lg:block">
              <svg
                viewBox="0 0 560 540"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-auto w-full"
              >
                <defs>
                  {/* Halos diffus par couleur */}
                  <radialGradient id="halo-center" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.16" />
                    <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="halo-tc" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="halo-pr" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="halo-sg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
                  </radialGradient>
                  {/* Gradient sparkline ascendant */}
                  <linearGradient id="grad-spark" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="1" />
                  </linearGradient>
                  {/* Gradient remplissage sparkline */}
                  <linearGradient id="grad-spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* ── Halos ambient larges ── */}
                <circle cx="280" cy="270" r="260" fill="url(#halo-center)" />

                {/* ── Anneaux concentriques décoratifs autour du centre ── */}
                <circle
                  cx="280"
                  cy="270"
                  r="180"
                  stroke="var(--color-border-strong)"
                  strokeOpacity="0.35"
                  strokeDasharray="2 6"
                  fill="none"
                />
                <circle
                  cx="280"
                  cy="270"
                  r="135"
                  stroke="var(--color-border-strong)"
                  strokeOpacity="0.55"
                  fill="none"
                />

                {/* ── Connexions courbes Bézier (3 services → centre) ── */}
                {/* Service 1 (haut, terracotta) */}
                <path
                  d="M 280 110 C 280 150, 280 180, 280 200"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                  strokeDasharray="3 5"
                  fill="none"
                />
                {/* Service 2 (bas-gauche, primary) — courbe douce */}
                <path
                  d="M 110 430 C 160 380, 200 340, 240 310"
                  stroke="var(--color-primary)"
                  strokeOpacity="0.5"
                  strokeWidth="1.5"
                  strokeDasharray="3 5"
                  fill="none"
                />
                {/* Service 3 (bas-droite, sage) — courbe symétrique */}
                <path
                  d="M 450 430 C 400 380, 360 340, 320 310"
                  stroke="var(--color-sage)"
                  strokeOpacity="0.5"
                  strokeWidth="1.5"
                  strokeDasharray="3 5"
                  fill="none"
                />

                {/* ── Centre : "votre entreprise" enrichi ── */}
                <circle cx="280" cy="270" r="78" fill="var(--color-paper)" />
                <circle
                  cx="280"
                  cy="270"
                  r="78"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.4"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Icône Brain stylisée (paths simples) */}
                <g transform="translate(263, 240)">
                  <path
                    d="M 17 5 C 12 2, 5 5, 5 12 C 2 14, 2 20, 6 22 C 6 25, 10 27, 13 26 L 13 28 L 17 28 L 17 5 Z"
                    fill="none"
                    stroke="var(--color-terracotta)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 17 5 C 22 2, 29 5, 29 12 C 32 14, 32 20, 28 22 C 28 25, 24 27, 21 26 L 21 28 L 17 28"
                    fill="none"
                    stroke="var(--color-terracotta)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 12 12 L 17 12 M 22 12 L 17 12 M 12 17 L 17 17 M 22 17 L 17 17"
                    stroke="var(--color-terracotta)"
                    strokeOpacity="0.5"
                    strokeWidth="0.8"
                  />
                </g>
                <text
                  x="280"
                  y="300"
                  textAnchor="middle"
                  fontFamily="var(--font-serif)"
                  fontSize="18"
                  fontStyle="italic"
                  fontWeight="500"
                  fill="var(--color-terracotta)"
                >
                  Votre entreprise
                </text>
                <text
                  x="280"
                  y="320"
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fontSize="10"
                  fontWeight="600"
                  letterSpacing="0.18em"
                  fill="var(--color-fg-muted)"
                >
                  + IA = GAINS
                </text>

                {/* ── Service 1 : INTERVENIR (haut, terracotta) ── */}
                <g>
                  <circle cx="280" cy="65" r="62" fill="url(#halo-tc)" />
                  <circle cx="280" cy="65" r="40" fill="var(--color-paper)" />
                  <circle
                    cx="280"
                    cy="65"
                    r="40"
                    stroke="var(--color-terracotta)"
                    strokeWidth="1.8"
                  />
                  {/* Icône Users (3 cercles) */}
                  <circle cx="270" cy="58" r="4" fill="var(--color-terracotta)" />
                  <circle cx="282" cy="56" r="5" fill="var(--color-terracotta)" />
                  <circle cx="294" cy="58" r="4" fill="var(--color-terracotta)" />
                  <path
                    d="M 264 70 Q 270 66 276 70 M 276 68 Q 282 64 288 68 M 288 70 Q 294 66 300 70"
                    stroke="var(--color-terracotta)"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <text
                    x="280"
                    y="86"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="9"
                    fontWeight="700"
                    letterSpacing="0.12em"
                    fill="var(--color-terracotta)"
                  >
                    INTERVENIR
                  </text>
                  {/* Badge "1 jour" */}
                  <g transform="translate(345, 50)">
                    <rect width="56" height="26" rx="13" fill="var(--color-terracotta-soft)" />
                    <text
                      x="28"
                      y="17"
                      textAnchor="middle"
                      fontFamily="var(--font-sans)"
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--color-terracotta-deep)"
                    >
                      1 jour
                    </text>
                  </g>
                  {/* Numéro 01 */}
                  <text
                    x="195"
                    y="72"
                    textAnchor="middle"
                    fontFamily="var(--font-serif)"
                    fontSize="42"
                    fontStyle="italic"
                    fontWeight="500"
                    fill="var(--color-terracotta)"
                    fillOpacity="0.4"
                  >
                    01
                  </text>
                </g>

                {/* ── Service 2 : AUDITER (bas-gauche, primary) ── */}
                <g>
                  <circle cx="110" cy="430" r="62" fill="url(#halo-pr)" />
                  <circle cx="110" cy="430" r="40" fill="var(--color-paper)" />
                  <circle
                    cx="110"
                    cy="430"
                    r="40"
                    stroke="var(--color-primary)"
                    strokeWidth="1.8"
                  />
                  {/* Icône Search (loupe) */}
                  <circle
                    cx="105"
                    cy="425"
                    r="9"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    fill="none"
                  />
                  <line
                    x1="113"
                    y1="433"
                    x2="120"
                    y2="440"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text
                    x="110"
                    y="455"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="9"
                    fontWeight="700"
                    letterSpacing="0.12em"
                    fill="var(--color-primary)"
                  >
                    AUDITER
                  </text>
                  {/* Badge "5 jours" */}
                  <g transform="translate(30, 460)">
                    <rect width="60" height="26" rx="13" fill="var(--color-primary-soft)" />
                    <text
                      x="30"
                      y="17"
                      textAnchor="middle"
                      fontFamily="var(--font-sans)"
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--color-primary)"
                    >
                      5 jours
                    </text>
                  </g>
                  <text
                    x="180"
                    y="448"
                    textAnchor="middle"
                    fontFamily="var(--font-serif)"
                    fontSize="42"
                    fontStyle="italic"
                    fontWeight="500"
                    fill="var(--color-primary)"
                    fillOpacity="0.4"
                  >
                    02
                  </text>
                </g>

                {/* ── Service 3 : IMPLÉMENTER (bas-droite, sage) ── */}
                <g>
                  <circle cx="450" cy="430" r="62" fill="url(#halo-sg)" />
                  <circle cx="450" cy="430" r="40" fill="var(--color-paper)" />
                  <circle cx="450" cy="430" r="40" stroke="var(--color-sage)" strokeWidth="1.8" />
                  {/* Icône Wand2 stylisée (étoile + baguette) */}
                  <path
                    d="M 450 416 L 452 422 L 458 422 L 453 426 L 455 432 L 450 428 L 445 432 L 447 426 L 442 422 L 448 422 Z"
                    fill="var(--color-sage)"
                  />
                  <line
                    x1="438"
                    y1="438"
                    x2="446"
                    y2="430"
                    stroke="var(--color-sage)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text
                    x="450"
                    y="455"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="9"
                    fontWeight="700"
                    letterSpacing="0.10em"
                    fill="var(--color-sage)"
                  >
                    IMPLÉMENTER
                  </text>
                  {/* Badge "sur mesure" */}
                  <g transform="translate(460, 460)">
                    <rect width="80" height="26" rx="13" fill="var(--color-sage-soft)" />
                    <text
                      x="40"
                      y="17"
                      textAnchor="middle"
                      fontFamily="var(--font-sans)"
                      fontSize="11"
                      fontWeight="600"
                      fill="var(--color-sage)"
                    >
                      sur mesure
                    </text>
                  </g>
                  <text
                    x="380"
                    y="448"
                    textAnchor="middle"
                    fontFamily="var(--font-serif)"
                    fontSize="42"
                    fontStyle="italic"
                    fontWeight="500"
                    fill="var(--color-sage)"
                    fillOpacity="0.4"
                  >
                    03
                  </text>
                </g>

                {/* ── Mini sparkline "courbe de gain" en bas ── */}
                <g transform="translate(220, 510)">
                  {/* Aire remplie */}
                  <path
                    d="M 0 16 L 15 14 L 30 13 L 45 11 L 60 8 L 75 6 L 90 3 L 105 1 L 120 0 L 120 20 L 0 20 Z"
                    fill="url(#grad-spark-fill)"
                  />
                  {/* Ligne sparkline */}
                  <path
                    d="M 0 16 L 15 14 L 30 13 L 45 11 L 60 8 L 75 6 L 90 3 L 105 1 L 120 0"
                    stroke="url(#grad-spark)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Point final highlighted */}
                  <circle cx="120" cy="0" r="3.5" fill="var(--color-terracotta)" />
                  <circle cx="120" cy="0" r="6" fill="var(--color-terracotta)" fillOpacity="0.25" />
                </g>
                <text
                  x="280"
                  y="500"
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fontSize="9"
                  fontWeight="600"
                  letterSpacing="0.18em"
                  fill="var(--color-fg-muted)"
                >
                  ↗ GAINS DANS LE TEMPS
                </text>

                {/* ── Data badges flottants (bénéfices concrets) ── */}
                <g transform="translate(395, 200)">
                  <rect
                    width="118"
                    height="32"
                    rx="16"
                    fill="var(--color-paper)"
                    stroke="var(--color-border-strong)"
                  />
                  <text
                    x="59"
                    y="20"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-fg)"
                  >
                    +1 à 3 h / jour
                  </text>
                </g>
                <g transform="translate(40, 160)">
                  <rect
                    width="100"
                    height="32"
                    rx="16"
                    fill="var(--color-paper)"
                    stroke="var(--color-border-strong)"
                  />
                  <text
                    x="50"
                    y="20"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-primary)"
                  >
                    +CA · −coûts
                  </text>
                </g>
                <g transform="translate(420, 320)">
                  <rect
                    width="100"
                    height="32"
                    rx="16"
                    fill="var(--color-paper)"
                    stroke="var(--color-border-strong)"
                  />
                  <text
                    x="50"
                    y="20"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--color-sage)"
                  >
                    Marges +
                  </text>
                </g>

                {/* ── Particules + étoiles décoratives ── */}
                <circle cx="50" cy="60" r="2.5" fill="var(--color-terracotta)" opacity="0.6" />
                <circle cx="510" cy="100" r="2" fill="var(--color-primary)" opacity="0.55" />
                <circle cx="540" cy="280" r="2.5" fill="var(--color-sage)" opacity="0.5" />
                <circle cx="20" cy="320" r="2" fill="var(--color-terracotta)" opacity="0.5" />
                <circle cx="180" cy="20" r="1.5" fill="var(--color-sage)" opacity="0.45" />
                <circle cx="380" cy="40" r="1.5" fill="var(--color-primary)" opacity="0.45" />
                {/* Étoiles 4-pointes */}
                <path
                  d="M 30 240 L 32 246 L 38 248 L 32 250 L 30 256 L 28 250 L 22 248 L 28 246 Z"
                  fill="var(--color-terracotta)"
                  opacity="0.5"
                />
                <path
                  d="M 530 170 L 532 175 L 537 177 L 532 179 L 530 184 L 528 179 L 523 177 L 528 175 Z"
                  fill="var(--color-primary)"
                  opacity="0.4"
                />
              </svg>
            </div>
          </div>
        </Container>
      </section>

      {/* ───────────── VALUE PROPOSITION (3 services + bénéfice client) ─────────────
          C'est LA section la plus importante de la page — visibilité maximum,
          chaque service a SA couleur d'accent dédiée. */}
      <section className="bg-paper relative py-28 sm:py-32 lg:py-40">
        <Container>
          <FadeInOnView>
            <div className="mb-20 max-w-4xl">
              <p className="text-fg-muted mb-6 text-[13px] font-semibold tracking-[0.18em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("valueEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.5rem,5.5vw,5rem)] leading-[1.0] font-semibold tracking-tight">
                {t("valueTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("valueTitleEm")}
                </span>
                {t("valueTitlePart2")}
              </h2>
              <p className="text-fg-soft mt-8 max-w-3xl text-lg leading-relaxed sm:text-xl">
                {t("valueDescription")}
              </p>
            </div>
          </FadeInOnView>

          <ul className="grid gap-8 lg:grid-cols-3">
            {valuePropositions.map((v, idx) => {
              const Icon = v.icon;
              const a = accentClasses[v.accent];
              return (
                <FadeInOnView key={v.id} delay={idx * 100}>
                  <li className="h-full">
                    <Link
                      href={v.href}
                      className={cn(
                        "group bg-bg border-border focus-visible:ring-primary hover:shadow-card relative flex h-full flex-col gap-7 overflow-hidden rounded-3xl border p-10 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        a.hoverBorder,
                        // Halo accent diffus en arrière-plan, plus visible au hover
                        "before:pointer-events-none before:absolute before:-top-32 before:-right-20 before:h-72 before:w-72 before:rounded-full before:opacity-50 before:blur-3xl before:transition-opacity before:duration-500 group-hover:before:opacity-100",
                        a.ringHalo,
                      )}
                    >
                      {/* En-tête : numéro géant serif + icône accent */}
                      <div className="relative flex items-start justify-between">
                        <span
                          className={cn("text-7xl leading-none font-medium tabular-nums", a.number)}
                          style={{ fontFamily: "var(--font-serif)" }}
                          aria-hidden="true"
                        >
                          0{idx + 1}
                        </span>
                        <span
                          className={cn(
                            "inline-flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110",
                            a.iconBg,
                            a.iconFg,
                          )}
                        >
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                      </div>

                      {/* Action + headline */}
                      <div className="relative">
                        <h3
                          className="text-fg text-3xl leading-[1.1] font-medium tracking-tight"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {v.action}
                        </h3>
                        <p
                          className={cn("mt-3 text-lg italic", a.headline)}
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {v.headline}
                        </p>
                      </div>

                      {/* Bullets ultra-concrets */}
                      <ul className="relative flex flex-1 flex-col gap-4">
                        {v.bullets.map((b, i) => (
                          <li
                            key={i}
                            className="text-fg-soft flex items-start gap-3 text-[15px] leading-relaxed"
                          >
                            <Check
                              className={cn("mt-1 h-4 w-4 shrink-0", a.bulletIcon)}
                              aria-hidden="true"
                            />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Gain client — bandeau coloré accent (mise en avant maximale) */}
                      <div className={cn("relative rounded-xl px-5 py-4", a.gainBg)}>
                        <p className={cn("text-base leading-snug font-semibold", a.gainText)}>
                          {v.gain}
                        </p>
                      </div>

                      {/* Prix + lien détail */}
                      <div className="border-border relative flex items-center justify-between border-t pt-5">
                        <span className="text-fg text-sm font-semibold">{v.price}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 text-sm font-semibold",
                            a.headline,
                          )}
                        >
                          {isFr ? "Voir le détail" : "See details"}
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </span>
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
