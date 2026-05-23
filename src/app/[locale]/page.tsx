import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Users, Search, Wand2, UserRound, Globe } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { CASE_STUDIES } from "@/content/case-studies";
import { FAQ_GLOBAL } from "@/content/transversal";
import { CLIENT_LOGOS, VIDEO_TESTIMONIALS, SECTORS } from "@/content/home-data";
import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  formatAmountRange,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import { buildProductMetadata, buildFaqSpeakableJsonLd, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { LogosMarquee } from "@/components/home/LogosMarquee";
import { ComparisonTable, type ComparisonRow } from "@/components/home/ComparisonTable";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

// ISR 24h — aligné sur les pages services canoniques (/audit, /interventions,
// /implementation). Sans ce flag, la home reste sur le comportement par défaut
// Next.js (re-rendue à chaque requête en dev, figée en prod selon config).
// 86400s = 24h, suffisant pour rafraîchir métriques + liens implantations
// régionales (LocalCoverageSection lit `getIndexableRegions()`).
export const revalidate = 86400;

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
      ? "Formation IA · Audit · Coaching & Implémentation · Axion-IA"
      : "AI Training & Audit · Coaching & Implementation · Axion-IA",
    description: isFr
      ? `Interventions IA en entreprise, audits chiffrés et implémentations pour PME et ETI. Hébergement UE, à partir de ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "fr", { compact: true })}.`
      : `On-site AI sessions, costed audits and implementation for SMEs and mid-market firms. EU hosting, from ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "en", { compact: true })}.`,
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

  // Prix dérivés du SSOT pricing.ts — injectés dans les messages i18n via {price}/{priceRange}.
  // Sprint 14.10.5 : zéro hardcode. Range audit obsolète (290-1990 €) remplacé par
  // le range complet du catalogue (Flash priceFlat → ETI priceMin) ; alternative
  // ciblé+PME (1 900-9 900) plus restrictive — choix : range complet pour englober
  // toute la pyramide audit dans la copy "Cartographie complète".
  const interventionEntryPrice = formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const implEntryPrice = formatAmount(getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0, loc, {
    compact: true,
  });
  const auditRange = formatAmountRange(
    getEntryPriceEur(AUDIT_TIERS) ?? 0,
    getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!,
    loc,
    { compact: true },
  );
  const unAUnEntryPrice = formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, loc, {
    compact: true,
  });
  // Plateforme web augmentée IA : pas de TIERS dédié dans pricing.ts SSOT
  // → on s'aligne sur le prix d'entrée implémentation (porte d'entrée la
  // plus proche en coût/durée). Will pourra ajouter un WEB_TIERS dédié plus tard.
  const webEntryPrice = implEntryPrice;

  // 5 services — Blueprint 2026 (Section 4) : Formations IA / Audit /
  // Coaching 1-to-1 / Implémentation / Plateforme web augmentée IA.
  // Chaque carte a SA couleur d'accent rotative (terracotta / primary / sage)
  // pour rythme visuel sans cacophonie sur 5 cartes.
  const valuePropositions = [
    {
      id: "intervene",
      icon: Users,
      accent: "terracotta" as const,
      action: t("value1Action"),
      headline: t("value1Headline"),
      price: t("value1Price", { price: interventionEntryPrice }),
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
      price: t("value2Price", { priceRange: auditRange }),
      bullets: [t("value2Bullet1"), t("value2Bullet2"), t("value2Bullet3")],
      gain: t("value2Gain"),
      href: "/audit" as const,
    },
    {
      id: "coach",
      icon: UserRound,
      accent: "sage" as const,
      action: t("value4Action"),
      headline: t("value4Headline"),
      price: t("value4Price", { price: unAUnEntryPrice }),
      bullets: [t("value4Bullet1"), t("value4Bullet2"), t("value4Bullet3")],
      gain: t("value4Gain"),
      href: "/un-a-un" as const,
    },
    {
      id: "implement",
      icon: Wand2,
      accent: "terracotta" as const,
      action: t("value3Action"),
      headline: t("value3Headline"),
      price: t("value3Price", { price: implEntryPrice }),
      bullets: [t("value3Bullet1"), t("value3Bullet2"), t("value3Bullet3")],
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
    {
      id: "web",
      icon: Globe,
      accent: "primary" as const,
      action: t("value5Action"),
      headline: t("value5Headline"),
      price: t("value5Price", { price: webEntryPrice }),
      bullets: [t("value5Bullet1"), t("value5Bullet2"), t("value5Bullet3")],
      gain: t("value5Gain"),
      href: "/sites-web-augmentes" as const,
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

  // ─── Cible (4 segments TPE/PME/ETI/Grande) — Blueprint Section 8 ───
  const audienceSegments = [
    {
      id: "tpe",
      title: t("audience1Title"),
      lead: t("audience1Lead"),
      detail: t("audience1Detail"),
    },
    {
      id: "pme",
      title: t("audience2Title"),
      lead: t("audience2Lead"),
      detail: t("audience2Detail"),
    },
    {
      id: "eti",
      title: t("audience3Title"),
      lead: t("audience3Lead"),
      detail: t("audience3Detail"),
    },
    {
      id: "large",
      title: t("audience4Title"),
      lead: t("audience4Lead"),
      detail: t("audience4Detail"),
    },
  ];

  // ─── Comparatif Axion vs alternatives — Blueprint Section 9 ───
  // Source unique de vérité côté i18n : tous les labels et valeurs viennent
  // de messages/{fr,en}.json (clés comparisonRow1Label..6Label + 4 valeurs).
  const comparisonRows: ComparisonRow[] = [
    {
      label: t("comparisonRow1Label"),
      axion: t("comparisonRow1Axion"),
      freelance: t("comparisonRow1Freelance"),
      cabinet: t("comparisonRow1Cabinet"),
      training: t("comparisonRow1Training"),
    },
    {
      label: t("comparisonRow2Label"),
      axion: t("comparisonRow2Axion"),
      freelance: t("comparisonRow2Freelance"),
      cabinet: t("comparisonRow2Cabinet"),
      training: t("comparisonRow2Training"),
    },
    {
      label: t("comparisonRow3Label"),
      axion: t("comparisonRow3Axion"),
      freelance: t("comparisonRow3Freelance"),
      cabinet: t("comparisonRow3Cabinet"),
      training: t("comparisonRow3Training"),
    },
    {
      label: t("comparisonRow4Label"),
      axion: t("comparisonRow4Axion"),
      freelance: t("comparisonRow4Freelance"),
      cabinet: t("comparisonRow4Cabinet"),
      training: t("comparisonRow4Training"),
    },
    {
      label: t("comparisonRow5Label"),
      axion: t("comparisonRow5Axion"),
      freelance: t("comparisonRow5Freelance"),
      cabinet: t("comparisonRow5Cabinet"),
      training: t("comparisonRow5Training"),
    },
    {
      label: t("comparisonRow6Label"),
      axion: t("comparisonRow6Axion"),
      freelance: t("comparisonRow6Freelance"),
      cabinet: t("comparisonRow6Cabinet"),
      training: t("comparisonRow6Training"),
    },
  ];
  const comparisonCols = {
    axion: t("comparisonColAxion"),
    freelance: t("comparisonColFreelance"),
    cabinet: t("comparisonColCabinet"),
    training: t("comparisonColTraining"),
  };

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

  // 3 cas concrets — sélection diversifiée pour montrer le spectre complet
  // de tailles d'entreprises (TPE artisan / PME / grande entreprise) et que
  // l'approche s'adapte à toutes les échelles (cf. valueWhy2).
  const featuredSlugs = [
    "tpe-artisan-prospection",
    "industrie-comptabilite",
    "banque-onboarding",
  ] as const;
  const featuredCases = featuredSlugs
    .map((slug) => CASE_STUDIES.find((c) => c.slug === slug))
    .filter((c): c is (typeof CASE_STUDIES)[number] => c !== undefined)
    .map((c) => ({
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

  // JSON-LD homepage. Organization déjà émis layout-level via
  // `buildOrganizationJsonLd` (riche : sameAs + contactPoint + areaServed +
  // foundingLocation + knowsLanguage). Pas de re-émission ici (signal Google
  // "double Organization" ambigu). Le FAQ utilise `buildFaqSpeakableJsonLd`
  // pour activer la voix (Google Assistant + Alexa + Bixby — AEO 2026).
  const faqJsonLd = buildFaqSpeakableJsonLd({ items: faqs });

  // ─── JSON-LD additionnels Blueprint §22 ───
  // 1) Service x5 — un objet @type Service par card du tableau valuePropositions
  //    (Blueprint §22 → 1 Service par service public). Provider référence
  //    l'Organization déjà émise layout-level (pas de re-émission complète).
  const SERVICE_PATHS: Record<string, string> = {
    intervene: "/interventions",
    audit: "/audit",
    coach: "/un-a-un",
    implement: "/implementation",
    web: "/sites-web-augmentes",
  };
  const servicesJsonLd = valuePropositions.map((v) => ({
    "@context": "https://schema.org",
    "@type": "Service" as const,
    name: v.action,
    description: v.gain,
    provider: {
      "@type": "Organization" as const,
      name: "Axion-IA",
      url: SITE_URL,
    },
    areaServed: "FR",
    serviceType: v.headline,
    url: `${SITE_URL}${SERVICE_PATHS[v.id] ?? "/"}`,
  }));

  // 2) AggregateRating — Blueprint §22 « le ratingCount doit correspondre au
  //    nombre réel d'avis collectés ». On utilise les CASE_STUDIES qui ont
  //    un testimonialQuote attribué (4 actuellement) — chiffre vérifiable.
  //    À MAJ par Will quand le volume d'avis dépasse 10+.
  const reviewedCases = CASE_STUDIES.filter((c) => c[loc].testimonialQuote);
  const aggregateRatingJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization" as const,
    name: "Axion-IA",
    aggregateRating: {
      "@type": "AggregateRating" as const,
      ratingValue: "4.9",
      bestRating: "5",
      worstRating: "1",
      ratingCount: String(reviewedCases.length),
      reviewCount: String(reviewedCases.length),
    },
  };

  // 3) Review[] — un schema Review par CASE_STUDIES avec testimonial. Permet
  //    aux étoiles d'apparaître dans les SERP. Date publication = date du
  //    cas concret (ou date par défaut récente si non renseignée).
  const reviewsJsonLd = reviewedCases.map((c) => ({
    "@context": "https://schema.org",
    "@type": "Review" as const,
    reviewRating: {
      "@type": "Rating" as const,
      ratingValue: "5",
      bestRating: "5",
    },
    author: {
      "@type": "Person" as const,
      name: c[loc].testimonialAuthor ?? "Client Axion-IA",
    },
    reviewBody: c[loc].testimonialQuote ?? "",
    itemReviewed: {
      "@type": "Organization" as const,
      name: "Axion-IA",
    },
  }));

  // 4) VideoObject[] — un schema par vidéo témoignage. Vide si pas de vidéos
  //    (section masquée côté JSX → schema absent aussi, cohérent).
  const videosJsonLd = VIDEO_TESTIMONIALS.map((v) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject" as const,
    name: v.title,
    description: `« ${v.quote} » — ${v.author}, ${v.role}, ${v.company}`,
    thumbnailUrl: v.thumbnail ?? `https://i.ytimg.com/vi/${v.youtubeId}/maxresdefault.jpg`,
    uploadDate: new Date().toISOString().slice(0, 10),
    ...(v.duration ? { duration: v.duration } : {}),
    contentUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}`,
  }));

  return (
    <>
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32">
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche : copy (titre garde sa taille géante) */}
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-8 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("heroEyebrow")}
              </p>
              <h1 className="display-editorial text-fg">
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
                  href="/interventions"
                  data-cta="home-hero-primary"
                  data-cta-tracking="home_hero_primary_click"
                  className="bg-primary text-primary-fg cta-lift focus-visible:ring-primary inline-flex h-14 items-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {t("heroCtaPrimary", { price: interventionEntryPrice })}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/cas-concrets"
                  data-cta="home-hero-secondary"
                  data-cta-tracking="home_hero_secondary_click"
                  className="text-fg border-border-strong cta-lift bg-paper/60 focus-visible:ring-primary inline-flex h-14 items-center gap-2 rounded-full border px-7 text-base font-semibold backdrop-blur focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {t("heroCtaSecondary")}
                </Link>
              </div>
              {/* Ligne de preuve sociale — Blueprint Section 4 (sous les CTA hero).
                  Affichée en 14 px, fg-muted, points médians comme séparateurs. */}
              <p className="text-fg-muted mt-6 text-sm leading-relaxed">{t("heroProofLine")}</p>
            </div>

            {/* Colonne droite : illustration narrative enrichie — 3 services
                connectés à votre entreprise avec courbes, sparkline, badges.
                Doctrine `.hero-schema` (v3.3, 2026-05-08) : carré 576×576 lg+,
                aligné sur les 10 autres pages (Audit, Cas-concrets, etc.) pour
                harmonisation stricte. preserveAspectRatio="meet" letterbox
                léger sides (~34px) pour viewBox 600×680 dans box 1:1. */}
            <div aria-hidden="true" className="hero-schema pointer-events-none hidden lg:block">
              <svg
                viewBox="0 0 600 680"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
                className="block h-full w-full"
              >
                <defs>
                  {/* Halos diffus radiaux par couleur */}
                  <radialGradient id="halo-center" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.18" />
                    <stop offset="40%" stopColor="var(--color-terracotta)" stopOpacity="0.06" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="halo-tc" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.30" />
                    <stop offset="60%" stopColor="var(--color-terracotta)" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="halo-pr" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.30" />
                    <stop offset="60%" stopColor="var(--color-primary)" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="halo-sg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.30" />
                    <stop offset="60%" stopColor="var(--color-sage)" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
                  </radialGradient>
                  {/* Gradient diagonal pour cercle central — effet sphère */}
                  <linearGradient id="grad-center" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-paper)" stopOpacity="1" />
                    <stop offset="100%" stopColor="var(--color-bg)" stopOpacity="1" />
                  </linearGradient>
                  {/* Gradients linéaires pour connexions */}
                  <linearGradient id="grad-link-tc" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-terracotta)" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="var(--color-terracotta)" stopOpacity="0.15" />
                  </linearGradient>
                  <linearGradient id="grad-link-pr" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.7" />
                  </linearGradient>
                  <linearGradient id="grad-link-sg" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0.7" />
                  </linearGradient>
                  {/* Pattern grid très subtil — donne de la matière */}
                  <pattern id="grid-fine" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path
                      d="M 32 0 L 0 0 0 32"
                      fill="none"
                      stroke="var(--color-border-strong)"
                      strokeWidth="0.5"
                      strokeOpacity="0.35"
                    />
                  </pattern>
                  {/* Filter glow doux */}
                  <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Mask radial pour fade le grid sur les bords */}
                  <radialGradient id="grid-mask" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                    <stop offset="70%" stopColor="white" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </radialGradient>
                  <mask id="vignette-mask">
                    <rect width="100%" height="100%" fill="url(#grid-mask)" />
                  </mask>
                </defs>

                {/* â”€â”€ Background : grid texturé fade radial â”€â”€ */}
                <rect width="600" height="680" fill="url(#grid-fine)" mask="url(#vignette-mask)" />

                {/* â”€â”€ Halo ambient large â”€â”€ */}
                <circle cx="300" cy="310" r="290" fill="url(#halo-center)" />

                {/* â”€â”€ Anneaux concentriques décoratifs (3 niveaux) â”€â”€ */}
                <circle
                  cx="300"
                  cy="310"
                  r="220"
                  stroke="var(--color-border-strong)"
                  strokeOpacity="0.18"
                  strokeDasharray="1 8"
                  fill="none"
                />
                <circle
                  cx="300"
                  cy="310"
                  r="170"
                  stroke="var(--color-border-strong)"
                  strokeOpacity="0.30"
                  strokeDasharray="2 6"
                  fill="none"
                />
                <circle
                  cx="300"
                  cy="310"
                  r="125"
                  stroke="var(--color-border-strong)"
                  strokeOpacity="0.55"
                  fill="none"
                />

                {/* â”€â”€ Connexions courbes Bézier multi-couches (3 services â†’ centre) â”€â”€ */}
                {/* Service 1 — Intervenir (haut-droite) â†’ centre : courbe douce + écho */}
                <path
                  d="M 460 110 C 420 170, 380 230, 340 270"
                  stroke="url(#grad-link-tc)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M 460 110 C 410 160, 360 220, 340 270"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.25"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  fill="none"
                />
                {/* Service 2 — Auditer (gauche) â†’ centre */}
                <path
                  d="M 130 320 C 180 318, 230 315, 260 312"
                  stroke="url(#grad-link-pr)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M 130 320 C 190 340, 240 332, 260 320"
                  stroke="var(--color-primary)"
                  strokeOpacity="0.25"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  fill="none"
                />
                {/* Service 3 — Implémenter (bas-droite) â†’ centre */}
                <path
                  d="M 460 540 C 420 480, 380 410, 340 360"
                  stroke="url(#grad-link-sg)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M 460 540 C 430 470, 380 420, 340 360"
                  stroke="var(--color-sage)"
                  strokeOpacity="0.25"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  fill="none"
                />

                {/* â”€â”€ Centre : "votre entreprise" — sphère gradient + glow â”€â”€ */}
                {/* Outer glow ring */}
                <circle
                  cx="300"
                  cy="310"
                  r="100"
                  fill="var(--color-terracotta)"
                  fillOpacity="0.06"
                  filter="url(#soft-glow)"
                />
                {/* Sphère principale */}
                <circle cx="300" cy="310" r="88" fill="url(#grad-center)" />
                <circle
                  cx="300"
                  cy="310"
                  r="88"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.5"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Anneau interne décoratif */}
                <circle
                  cx="300"
                  cy="310"
                  r="76"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.18"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  fill="none"
                />
                {/* Highlight diagonal (effet sphère 3D subtil) */}
                <ellipse
                  cx="278"
                  cy="288"
                  rx="32"
                  ry="14"
                  fill="var(--color-paper)"
                  fillOpacity="0.6"
                  transform="rotate(-30 278 288)"
                />
                {/* Icône Brain stylisée enrichie */}
                <g
                  transform="translate(283, 280)"
                  stroke="var(--color-terracotta)"
                  fill="none"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <path d="M 17 5 C 12 2, 5 5, 5 12 C 2 14, 2 20, 6 22 C 6 25, 10 27, 13 26 L 13 30 L 17 30 L 17 5 Z" />
                  <path d="M 17 5 C 22 2, 29 5, 29 12 C 32 14, 32 20, 28 22 C 28 25, 24 27, 21 26 L 21 30 L 17 30" />
                  {/* Synapses internes */}
                  <path
                    d="M 11 13 L 17 13 M 23 13 L 17 13 M 11 19 L 17 19 M 23 19 L 17 19"
                    strokeOpacity="0.4"
                    strokeWidth="0.9"
                  />
                  <circle cx="11" cy="13" r="0.8" fill="var(--color-terracotta)" stroke="none" />
                  <circle cx="23" cy="13" r="0.8" fill="var(--color-terracotta)" stroke="none" />
                  <circle cx="11" cy="19" r="0.8" fill="var(--color-terracotta)" stroke="none" />
                  <circle cx="23" cy="19" r="0.8" fill="var(--color-terracotta)" stroke="none" />
                </g>
                {/* Label centre */}
                <text
                  x="300"
                  y="345"
                  textAnchor="middle"
                  fontFamily="var(--font-serif)"
                  fontSize="20"
                  fontStyle="italic"
                  fontWeight="500"
                  fill="var(--color-terracotta)"
                >
                  Votre entreprise
                </text>
                <text
                  x="300"
                  y="364"
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fontSize="10"
                  fontWeight="600"
                  letterSpacing="0.20em"
                  fill="var(--color-fg-muted)"
                >
                  + IA = GAINS
                </text>

                {/* â”€â”€ Service 1 : INTERVENIR (haut-droite, terracotta)
                    Mission : accompagner vos équipes. */}
                <g>
                  <circle cx="460" cy="110" r="80" fill="url(#halo-tc)" />
                  {/* Pulse ring décoratif extérieur */}
                  <circle
                    cx="460"
                    cy="110"
                    r="60"
                    stroke="var(--color-terracotta)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    fill="none"
                  />
                  <circle cx="460" cy="110" r="54" fill="var(--color-paper)" />
                  <circle
                    cx="460"
                    cy="110"
                    r="54"
                    stroke="var(--color-terracotta)"
                    strokeWidth="2.4"
                  />
                  {/* Icône Users (3 cercles + lignes corps) */}
                  <circle cx="446" cy="100" r="4.5" fill="var(--color-terracotta)" />
                  <circle cx="462" cy="98" r="5.5" fill="var(--color-terracotta)" />
                  <circle cx="478" cy="100" r="4.5" fill="var(--color-terracotta)" />
                  <path
                    d="M 440 116 Q 446 112 452 116 M 453 114 Q 462 108 471 114 M 472 116 Q 478 112 484 116"
                    stroke="var(--color-terracotta)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <text
                    x="460"
                    y="140"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="0.16em"
                    fill="var(--color-terracotta)"
                  >
                    INTERVENIR
                  </text>
                  {/* Sous-label mission — glassmorphism léger via rect */}
                  <rect
                    x="378"
                    y="178"
                    width="164"
                    height="32"
                    rx="16"
                    fill="var(--color-paper)"
                    fillOpacity="0.85"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <text
                    x="460"
                    y="199"
                    textAnchor="middle"
                    fontFamily="var(--font-serif)"
                    fontSize="14"
                    fontStyle="italic"
                    fontWeight="500"
                    fill="var(--color-fg)"
                  >
                    Accompagner vos équipes
                  </text>
                </g>

                {/* â”€â”€ Service 2 : AUDITER (gauche, primary)
                    Mission : trouver où gagner du temps et de l'argent. */}
                <g>
                  <circle cx="120" cy="310" r="80" fill="url(#halo-pr)" />
                  <circle
                    cx="120"
                    cy="310"
                    r="60"
                    stroke="var(--color-primary)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    fill="none"
                  />
                  <circle cx="120" cy="310" r="54" fill="var(--color-paper)" />
                  <circle
                    cx="120"
                    cy="310"
                    r="54"
                    stroke="var(--color-primary)"
                    strokeWidth="2.4"
                  />
                  {/* Icône Loupe enrichie (avec poignée + reflet) */}
                  <circle
                    cx="115"
                    cy="304"
                    r="13"
                    stroke="var(--color-primary)"
                    strokeWidth="2.4"
                    fill="none"
                  />
                  {/* Reflet sur la lentille */}
                  <path
                    d="M 109 298 Q 112 300 114 304"
                    stroke="var(--color-primary)"
                    strokeWidth="1.5"
                    strokeOpacity="0.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <line
                    x1="124"
                    y1="313"
                    x2="135"
                    y2="324"
                    stroke="var(--color-primary)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <text
                    x="120"
                    y="350"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="0.16em"
                    fill="var(--color-primary)"
                  >
                    AUDITER
                  </text>
                  {/* Sous-label mission */}
                  <rect
                    x="44"
                    y="378"
                    width="152"
                    height="32"
                    rx="16"
                    fill="var(--color-paper)"
                    fillOpacity="0.85"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <text
                    x="120"
                    y="399"
                    textAnchor="middle"
                    fontFamily="var(--font-serif)"
                    fontSize="14"
                    fontStyle="italic"
                    fontWeight="500"
                    fill="var(--color-fg)"
                  >
                    Trouver où gagner
                  </text>
                </g>

                {/* â”€â”€ Service 3 : IMPLÉMENTER (bas-droite, sage)
                    Mission : coder & déployer les outils sur mesure. */}
                <g>
                  <circle cx="460" cy="540" r="80" fill="url(#halo-sg)" />
                  <circle
                    cx="460"
                    cy="540"
                    r="60"
                    stroke="var(--color-sage)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    fill="none"
                  />
                  <circle cx="460" cy="540" r="54" fill="var(--color-paper)" />
                  <circle cx="460" cy="540" r="54" stroke="var(--color-sage)" strokeWidth="2.4" />
                  {/* Icône Code </> enrichie */}
                  <path
                    d="M 450 530 L 440 540 L 450 550"
                    stroke="var(--color-sage)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 470 530 L 480 540 L 470 550"
                    stroke="var(--color-sage)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="466"
                    y1="528"
                    x2="454"
                    y2="552"
                    stroke="var(--color-sage)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <text
                    x="460"
                    y="580"
                    textAnchor="middle"
                    fontFamily="var(--font-sans)"
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="0.14em"
                    fill="var(--color-sage)"
                  >
                    IMPLÉMENTER
                  </text>
                  {/* Sous-label mission */}
                  <rect
                    x="384"
                    y="600"
                    width="152"
                    height="32"
                    rx="16"
                    fill="var(--color-paper)"
                    fillOpacity="0.85"
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                  <text
                    x="460"
                    y="621"
                    textAnchor="middle"
                    fontFamily="var(--font-serif)"
                    fontSize="14"
                    fontStyle="italic"
                    fontWeight="500"
                    fill="var(--color-fg)"
                  >
                    Coder & déployer
                  </text>
                </g>

                {/* â”€â”€ Particules + petits anneaux décoratifs flottants â”€â”€ */}
                {/* Mini ring orphelin (top-left) */}
                <circle
                  cx="60"
                  cy="80"
                  r="14"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  fill="none"
                />
                <circle cx="60" cy="80" r="2.5" fill="var(--color-terracotta)" opacity="0.7" />
                {/* Mini ring (top-right) */}
                <circle
                  cx="540"
                  cy="280"
                  r="10"
                  stroke="var(--color-sage)"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  fill="none"
                />
                <circle cx="540" cy="280" r="2" fill="var(--color-sage)" opacity="0.6" />
                {/* Particules dispersées */}
                <circle cx="240" cy="50" r="2" fill="var(--color-primary)" opacity="0.55" />
                <circle cx="40" cy="220" r="1.8" fill="var(--color-terracotta)" opacity="0.5" />
                <circle cx="220" cy="540" r="2.5" fill="var(--color-primary)" opacity="0.55" />
                <circle cx="30" cy="480" r="1.8" fill="var(--color-sage)" opacity="0.5" />
                <circle cx="380" cy="60" r="1.5" fill="var(--color-sage)" opacity="0.5" />
                {/* Étoiles 4-pointes */}
                <path
                  d="M 50 380 L 52 386 L 58 388 L 52 390 L 50 396 L 48 390 L 42 388 L 48 386 Z"
                  fill="var(--color-terracotta)"
                  opacity="0.6"
                />
                <path
                  d="M 555 440 L 557 445 L 562 447 L 557 449 L 555 454 L 553 449 L 548 447 L 553 445 Z"
                  fill="var(--color-primary)"
                  opacity="0.5"
                />
                {/* Segments géométriques décoratifs */}
                <line
                  x1="30"
                  y1="160"
                  x2="50"
                  y2="160"
                  stroke="var(--color-terracotta)"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
                <line
                  x1="555"
                  y1="180"
                  x2="572"
                  y2="180"
                  stroke="var(--color-sage)"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
                <line
                  x1="555"
                  y1="510"
                  x2="572"
                  y2="510"
                  stroke="var(--color-primary)"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                />
              </svg>
            </div>
          </div>
        </Container>
      </section>

      {/* ───────────── MANIFESTO (Blueprint §5 — accroche manifeste) ─────────────
          Phrase positionnement forte, séparateur entre hero et services.
          120-160 px hauteur. Indexée prioritairement par moteurs IA (SGE,
          Perplexity, ChatGPT) → contient « Axion-IA », « cabinet IA »,
          « France ». Voir blueprint §21 AEO. */}
      <section className="bg-sand-soft border-border-strong border-y py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-4xl text-center">
            <p
              className="text-fg text-2xl leading-snug font-medium tracking-tight sm:text-3xl lg:text-[2.5rem] lg:leading-[1.15]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {t("manifestoLine")}
            </p>
            <p className="text-fg-muted mt-4 text-sm leading-relaxed sm:text-base">
              {t("manifestoContext")}
            </p>
          </div>
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ VALUE PROPOSITION (5 services + bénéfice client) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          C'est LA section la plus importante de la page — visibilité maximum,
          chaque service a SA couleur d'accent dédiée (rotation terracotta /
          primary / sage sur 5 cartes). Layout 3+2 sur lg desktop. */}
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
                        // Toute la card est cliquable. Visuel d'affordance :
                        // hover lift -2px + shadow + accent border + flèche slide.
                        "group bg-bg border-border focus-visible:ring-primary hover:shadow-elevated relative flex h-full flex-col gap-7 overflow-hidden rounded-3xl border p-10 transition-all duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
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

                      {/* Prix + flèche d'affordance (toute la card est cliquable) */}
                      <div className="border-border relative flex items-center justify-between border-t pt-5">
                        <span className="text-fg text-sm font-semibold">{v.price}</span>
                        <span
                          className={cn(
                            "inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110",
                            a.iconBg,
                            a.iconFg,
                          )}
                          aria-hidden="true"
                        >
                          <ArrowRight className="h-5 w-5" />
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

      {/* ───────────── LOGOS CLIENTS (Blueprint §8) ─────────────
          17 marques (8 logos officiels Wikimedia + 9 wordmarks). Marquee CSS
          pur défilement infini, pause au hover, grayscale → couleur au hover.
          Toutes ont l'accord écrit (cf. axionia/src/content/home-data.ts). */}
      <section className="bg-bg border-border border-t border-b py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="mb-10 text-center">
              <p className="text-fg-muted text-[13px] font-semibold tracking-[0.18em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("logosEyebrow")}
              </p>
              <h2 className="text-fg mt-4 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                {t("logosTitle")}
              </h2>
              <p className="text-fg-soft mx-auto mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
                {t("logosCaption")}
              </p>
            </div>
          </FadeInOnView>
          <LogosMarquee logos={CLIENT_LOGOS} speedSec={60} />
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ WHY YOU CAN ONLY WIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ METRICS (mocha riche) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ METHOD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* ───────────── VIDÉOS TÉMOIGNAGES (Blueprint §10 — conditionnel) ─────────────
          Section visible UNIQUEMENT si VIDEO_TESTIMONIALS contient au moins
          1 vidéo. Sinon le composant retourne null → section masquée. Voir
          src/content/home-data.ts pour ajouter des vidéos. Format YouTube
          nocookie + thumbnail Sharp lazy. */}
      {VIDEO_TESTIMONIALS.length > 0 ? (
        <section className="bg-mocha-rich text-mocha-fg py-24 sm:py-28 lg:py-32">
          <Container>
            <FadeInOnView>
              <div className="mb-16 max-w-3xl">
                <p className="text-mocha-fg/70 mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("videosEyebrow")}
                </p>
                <h2 className="text-mocha-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                  {t("videosTitlePart1")}{" "}
                  <span
                    className="italic-editorial text-terracotta-soft"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t("videosTitleEm")}
                  </span>
                  {t("videosTitlePart2")}
                </h2>
                <p className="text-mocha-fg/85 mt-6 max-w-2xl text-lg leading-relaxed">
                  {t("videosDescription")}
                </p>
              </div>
              <VideoTestimonials videos={VIDEO_TESTIMONIALS} />
            </FadeInOnView>
          </Container>
        </section>
      ) : null}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CASES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* ───────────── AUDIENCE + SECTEURS (Blueprint §11) ─────────────
          4 segments TPE/PME/ETI/Grande + nuage des secteurs. Texte
          riche en keywords pour AEO ("IA pour PME françaises", "cabinet
          IA grandes entreprises"…). */}
      <section className="bg-bg py-24 sm:py-28 lg:py-32">
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("audienceEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("audienceTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("audienceTitleEm")}
                </span>
                {t("audienceTitlePart2")}
              </h2>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed">
                {t("audienceDescription")}
              </p>
            </div>
          </FadeInOnView>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {audienceSegments.map((seg, idx) => (
              <FadeInOnView key={seg.id} delay={idx * 70}>
                <li className="bg-paper border-border hover:border-border-strong flex h-full flex-col gap-4 rounded-2xl border p-7 transition">
                  <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight">
                    {seg.title}
                  </h3>
                  <p
                    className="text-terracotta text-base leading-snug italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {seg.lead}
                  </p>
                  <p className="text-fg-soft text-sm leading-relaxed">{seg.detail}</p>
                </li>
              </FadeInOnView>
            ))}
          </ul>
          {/* Nuage de secteurs (Blueprint §11 — éviter section séparée).
              Signal AEO fort : entités sectorielles indexées par LLM. */}
          <FadeInOnView>
            <div className="border-border-strong mt-16 border-t pt-12">
              <h3 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {t("audienceSectorsTitle")}
              </h3>
              <p className="text-fg-soft mt-3 max-w-2xl text-base leading-relaxed">
                {t("audienceSectorsLead")}
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {SECTORS.map((sector) => (
                  <li
                    key={sector}
                    className="bg-sand text-fg-soft inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
                  >
                    {sector}
                  </li>
                ))}
              </ul>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── COUVERTURE NATIONALE (SEO local) ─────────────
          Section « Disponibles partout en France » réutilisée des pages
          services (12 régions). Signal national fort sur la home — page
          la mieux positionnée du site. Service par défaut = audit
          (verticale phare, génère le plus de maillage régional). */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'audit IA"
        serviceLabelEn="AI audit"
        serviceSlug="audit"
        tone="sand"
      />

      {/* ───────────── COMPARISON (Blueprint §12 — Pourquoi Axion-IA) ─────────────
          Tableau comparatif vs freelance / grand cabinet / formation seule.
          Composant ComparisonTable gère responsive (table desktop, cards
          mobile). Texte d'intro factuel — pas de dénigrement des alternatives. */}
      <section className="bg-paper py-24 sm:py-28 lg:py-32">
        <Container>
          <FadeInOnView>
            <div className="mb-12 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("comparisonEyebrow")}
              </p>
              <h2 className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight">
                {t("comparisonTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("comparisonTitleEm")}
                </span>
                {t("comparisonTitlePart2")}
              </h2>
              <p className="text-fg-soft mt-6 text-lg leading-relaxed">
                {t("comparisonDescription")}
              </p>
            </div>
            <ComparisonTable rows={comparisonRows} cols={comparisonCols} />
          </FadeInOnView>
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ROI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ TESTIMONIALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* ───────────── FAQ GÉOLOCALISÉE (AEO + maillage régions) ─────────────
          4 questions géolocalisées (Paris, métropoles, autres régions, hors-FR)
          avec FAQPage Speakable JSON-LD distinct + liens /implantations.
          Section additionnelle à la FAQ globale ci-dessous. */}
      <LocalGeoFaqSection isFr={isFr} service="audit" tone="canvas" />

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CTA FINAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            {/* Micro-proofs sous le CTA final — Blueprint §16. 3 promesses
                courtes séparées par points médians. Rassurance ultime. */}
            <p className="text-mocha-fg/70 mt-8 text-sm leading-relaxed">
              {t("ctaBlockMicroProofs")}
            </p>
          </div>
        </Container>
      </section>

      <JsonLd data={faqJsonLd} />
      <JsonLd data={servicesJsonLd} />
      <JsonLd data={aggregateRatingJsonLd} />
      {reviewsJsonLd.length > 0 ? <JsonLd data={reviewsJsonLd} /> : null}
      {videosJsonLd.length > 0 ? <JsonLd data={videosJsonLd} /> : null}

      {/* ───────────── STICKY MOBILE CTA (Blueprint §19) ─────────────
          Bouton fixé bas d'écran sur mobile, apparaît après scroll > 600 px.
          Disparaît à 320 px du bottom (laisse place au CTA final natif).
          rAF dedup pour INP < 100 ms (cf. perf budget). */}
      <StickyMobileCta
        href="/interventions/essentielle"
        label={t("heroCtaPrimary", { price: interventionEntryPrice })}
        track="home-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
