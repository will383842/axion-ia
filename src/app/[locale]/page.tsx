import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, TrendingUp, Target, Lightbulb, Star } from "lucide-react";
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
import { Illustration } from "@/components/visual/Illustration";
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
      emoji: "🎓",
      accent: "terracotta" as const,
      action: t("value1Action"),
      headline: t("value1Headline"),
      price: t("value1Price", { price: interventionEntryPrice }),
      bullets: [t("value1Bullet1")],
      gain: t("value1Gain"),
      href: "/interventions" as const,
    },
    {
      id: "coach",
      emoji: "🧑‍💼",
      accent: "primary" as const,
      action: t("value4Action"),
      headline: t("value4Headline"),
      price: t("value4Price", { price: unAUnEntryPrice }),
      bullets: [t("value4Bullet1")],
      gain: t("value4Gain"),
      href: "/un-a-un" as const,
    },
    {
      id: "audit",
      emoji: "🔍",
      accent: "sage" as const,
      action: t("value2Action"),
      headline: t("value2Headline"),
      price: t("value2Price", { priceRange: auditRange }),
      bullets: [t("value2Bullet1")],
      gain: t("value2Gain"),
      href: "/audit" as const,
    },
    {
      id: "implement",
      emoji: "⚙️",
      accent: "terracotta" as const,
      action: t("value3Action"),
      headline: t("value3Headline"),
      price: t("value3Price", { price: implEntryPrice }),
      bullets: [t("value3Bullet1")],
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
    {
      id: "web",
      emoji: "🌐",
      accent: "primary" as const,
      action: t("value5Action"),
      headline: t("value5Headline"),
      price: t("value5Price", { price: webEntryPrice }),
      bullets: [t("value5Bullet1")],
      gain: t("value5Gain"),
      href: "/sites-web-augmentes" as const,
    },
  ];

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
              {/* Polish v7 (Will 2026-05-23) : pas de CTA hero (les 5 cards services
                  font office de CTA). Proof line minimale réintégrée. */}
              <p className="text-fg-muted mt-8 text-sm leading-relaxed sm:text-base">
                <span className="text-terracotta font-semibold">{t("heroProofLine")}</span>
              </p>
            </div>

            {/* Colonne droite : photo hero placeholder. Will drop l'image
                réelle (dashboard / livrable Axion-IA / capture produit) dans
                `public/illustrations/home-hero-dashboard.avif`. En attendant,
                placeholder on-brand respectant aspect ratio 1:1 → 0 CLS. */}
            <div className="hidden lg:block">
              <Illustration
                slot="HOME-01-hero"
                src="/illustrations/home-hero-equipe.png"
                aspectRatio="1:1"
                filenameTarget="public/illustrations/home-hero-equipe.png"
                caption={
                  isFr
                    ? "L'équipe Axion-IA — l'IA au service de l'humain"
                    : "The Axion-IA team — AI at the service of humans"
                }
                alt={
                  isFr
                    ? "Photo de l'équipe Axion-IA en pulls terracotta sous le logo « Axion-IA.com — L'intelligence artificielle au service de l'humain »."
                    : "Photo of the Axion-IA team wearing terracotta sweaters under the « Axion-IA.com — AI at the service of humans » sign."
                }
                priority
              />
            </div>
            {/* Bloc SVG décoratif retiré (commit polish) — remplacé par
                Illustration placeholder photo (LCP optimisé, bundle -657 l.).
                Ancien SVG complexe préservé dans git history si besoin de
                revert : commit c617a046^. */}
          </div>
        </Container>
      </section>

      {/* ─── MANIFESTO retiré (commit polish v5, demande Will) ───
          Phrase positionnement déplacée vers metaDescription seo + AEO via
          Organization JSON-LD. Visuel privilégié au texte. */}

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ VALUE PROPOSITION (5 services + bénéfice client) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          C'est LA section la plus importante de la page — visibilité maximum,
          chaque service a SA couleur d'accent dédiée (rotation terracotta /
          primary / sage sur 5 cartes). Layout 3+2 sur lg desktop. */}
      <section className="bg-paper relative py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-20 max-w-4xl text-center">
              <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
                {isFr ? "Nos interventions" : "Our services"}
              </p>
              <h2 className="text-fg text-[clamp(2.5rem,5vw,4.5rem)] leading-[1.02] font-semibold tracking-tight">
                {isFr ? "Pourquoi vous ne pouvez" : "Why you can only"}
                <br />
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "que gagner" : "win"}
                </span>
              </h2>
              <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "Chaque type d'intervention produit un gain mesurable — en heures, en process, en chiffre d'affaires."
                  : "Every type of engagement produces a measurable gain — in hours, processes, revenue."}
              </p>
            </div>
          </FadeInOnView>

          {/* 5 cartes en 1 ligne sur desktop (lg+), 2 col tablet, 1 col mobile.
              Cartes compactes, ULTRA contrastées : background accent-soft +
              numéro géant outline serif + action bold + headline lead.
              Pas de prix (visible sur la page service détail). */}
          {/* 5 cartes en couleur PLEINE — punch maximal. Numéro géant en
              filigrane (background décoratif), icône paper-circle accent en
              haut, h3 + headline en bas. Aspect 3:4 vertical strict, 5 col
              toujours, grid responsive 320→1280+. */}
          <div className="flex flex-col gap-16 sm:gap-20 lg:gap-24">
            {(
              [
                {
                  num: "01",
                  emoji: "🎓",
                  accent: "terracotta",
                  service: isFr ? "Formations" : "Training",
                  headlineFr: "Vos salariés appliquent dès le lendemain",
                  headlineEn: "Your team applies from day one",
                  descFr:
                    "On part de leurs outils, leurs tâches, leur métier. Pas de slides théoriques — chaque participant repart avec des automatisations qu'il active le lendemain matin.",
                  descEn:
                    "We start from their tools, their tasks, their work. No theoretical slides — every participant leaves with automations they activate the next morning.",
                  bulletsFr: [
                    "Gain de temps immédiat sur les tâches répétitives",
                    "Compétences ancrées dans leur réalité, pas dans un manuel",
                    "Toute l'équipe monte en niveau en même temps",
                    "Applicable dès le lendemain matin",
                  ],
                  bulletsEn: [
                    "Immediate time savings on repetitive tasks",
                    "Skills rooted in their reality, not in a manual",
                    "The whole team levels up at the same time",
                    "Applicable from the next morning",
                  ],
                  href: "/interventions" as const,
                },
                {
                  num: "02",
                  emoji: "🔍",
                  accent: "sage",
                  service: isFr ? "Audits" : "Audits",
                  headlineFr: "On trouve exactement ce qui vous coûte du temps et de l'argent",
                  headlineEn: "We find exactly what's costing you time and money",
                  descFr:
                    "Analyse de vos process, outils, flux. Vous repartez avec les 5 actions prioritaires classées par impact — pas un rapport de 80 pages à mettre dans un tiroir.",
                  descEn:
                    "Analysis of your processes, tools, flows. You leave with the 5 priority actions ranked by impact — not an 80-page report to file away.",
                  bulletsFr: [
                    "Gains potentiels identifiés et chiffrés",
                    "Feuille de route claire, priorisée, actionnable",
                    "Zéro jargon — vous savez exactement quoi faire ensuite",
                    "Rapport livré — pas une présentation floue",
                  ],
                  bulletsEn: [
                    "Potential gains identified and quantified",
                    "Clear, prioritized, actionable roadmap",
                    "Zero jargon — you know exactly what to do next",
                    "Delivered report — not a fuzzy slideshow",
                  ],
                  href: "/audit" as const,
                },
                {
                  num: "03",
                  emoji: "🧑‍💼",
                  accent: "primary",
                  service: isFr ? "Accompagnement 1-to-1" : "1-to-1 coaching",
                  headlineFr: "On ouvre votre poste ensemble — et on récupère vos heures perdues",
                  headlineEn: "We open your workstation together — and reclaim your lost hours",
                  descFr:
                    "Dirigeant ou collaborateur : on analyse vos vrais outils, vos vraies tâches. Ce qui peut être automatisé l'est. Ce qui peut être supprimé disparaît. Résultat : plusieurs heures récupérées chaque jour.",
                  descEn:
                    "Executive or employee: we analyze your real tools, your real tasks. What can be automated is. What can be removed disappears. Result: several hours reclaimed every day.",
                  bulletsFr: [
                    "Travail sur votre cas réel, pas un exemple générique",
                    "Automatisations actives à la fin de la session",
                    "ROI visible dès le lendemain",
                    "1 session = plusieurs heures/jour récupérées",
                  ],
                  bulletsEn: [
                    "Work on your real case, not a generic example",
                    "Live automations by the end of the session",
                    "ROI visible the next day",
                    "1 session = several hours/day reclaimed",
                  ],
                  href: "/un-a-un" as const,
                },
                {
                  num: "04",
                  emoji: "⚙️",
                  accent: "terracotta",
                  service: isFr ? "Implémentation d'automatisations" : "Automation implementation",
                  headlineFr: "On branche. Ça tourne. Vous récupérez des heures — chaque jour",
                  headlineEn: "We plug in. It runs. You reclaim hours — every day",
                  descFr:
                    "On construit et déploie vos automatisations sur mesure. Dès la mise en production, ce sont des tâches qui disparaissent de votre quotidien — pour toujours.",
                  descEn:
                    "We build and deploy your custom automations. From go-live, these are tasks that vanish from your day-to-day — for good.",
                  bulletsFr: [
                    "Livré, testé, opérationnel — pas un prototype",
                    "Économies immédiates dès le premier jour de production",
                    "Vous parlez à celui qui code — zéro intermédiaire",
                    "En prod = heures récupérées instantanément",
                  ],
                  bulletsEn: [
                    "Delivered, tested, operational — not a prototype",
                    "Immediate savings from day one in production",
                    "You talk to the person who codes — zero middleman",
                    "Live = hours reclaimed instantly",
                  ],
                  href: "/implementation" as const,
                },
                {
                  num: "05",
                  emoji: "🌐",
                  accent: "primary",
                  service: isFr ? "Plateforme web augmentée à l'IA" : "AI-augmented web platform",
                  headlineFr:
                    "Votre outil métier, repensé avec l'IA au cœur — plus rapide, plus intelligent, plus rentable",
                  headlineEn:
                    "Your business tool, redesigned with AI at the core — faster, smarter, more profitable",
                  descFr:
                    "On conçoit et développe votre plateforme web sur mesure avec l'IA intégrée nativement : recommandations, automatisations, analyse de données en temps réel, interfaces intelligentes. Vous ne remplacez pas votre outil existant — vous le transcendez.",
                  descEn:
                    "We design and build your custom web platform with AI natively integrated: recommendations, automations, real-time data analysis, intelligent interfaces. You don't replace your existing tool — you transcend it.",
                  bulletsFr: [
                    "Stack moderne, évolutif, sans dette technique",
                    "IA intégrée dès la conception — pas ajoutée après",
                    "Hébergement Europe, RGPD strict, données chez vous",
                    "Un outil qui travaille pour vous — 24h/24, 7j/7",
                  ],
                  bulletsEn: [
                    "Modern, scalable stack, no technical debt",
                    "AI integrated from day one — not bolted on",
                    "European hosting, strict GDPR, your data stays yours",
                    "A tool that works for you — 24/7",
                  ],
                  href: "/sites-web-augmentes" as const,
                },
              ] as const
            ).map((block, idx) => {
              const reverse = idx % 2 === 1;
              const accentBg =
                block.accent === "terracotta"
                  ? "bg-terracotta"
                  : block.accent === "sage"
                    ? "bg-sage"
                    : "bg-primary";
              const accentText =
                block.accent === "terracotta"
                  ? "text-terracotta"
                  : block.accent === "sage"
                    ? "text-sage"
                    : "text-primary";
              return (
                <FadeInOnView key={block.num} delay={idx * 40}>
                  <article
                    className={cn(
                      "grid items-center gap-10 lg:grid-cols-2 lg:gap-16",
                      reverse && "lg:[&>div:first-child]:order-2",
                    )}
                  >
                    <div>
                      <div className="mb-6 flex items-center gap-5">
                        <span
                          className={cn(
                            "text-[clamp(3.5rem,6vw,5rem)] leading-none font-semibold tabular-nums",
                            accentText,
                          )}
                          style={{ fontFamily: "var(--font-serif)" }}
                          aria-hidden="true"
                        >
                          {block.num}
                        </span>
                        <span
                          className={cn(
                            "inline-flex h-14 w-14 items-center justify-center rounded-full text-2xl",
                            accentBg,
                          )}
                          aria-hidden="true"
                        >
                          {block.emoji}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mb-3 text-[12px] font-bold tracking-[0.2em] uppercase",
                          accentText,
                        )}
                      >
                        {block.service}
                      </p>
                      <h3
                        className="text-fg text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-tight"
                        style={{ fontFamily: "var(--font-serif)" }}
                      >
                        {isFr ? block.headlineFr : block.headlineEn}
                      </h3>
                    </div>

                    <div>
                      <p className="text-fg-soft text-base leading-relaxed sm:text-lg">
                        {isFr ? block.descFr : block.descEn}
                      </p>
                      <ul className="mt-7 flex flex-col gap-3">
                        {(isFr ? block.bulletsFr : block.bulletsEn).map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-3">
                            <span
                              className={cn(
                                "mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                                accentBg,
                              )}
                              aria-hidden="true"
                            />
                            <span className="text-fg text-base leading-relaxed">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={block.href}
                        className={cn(
                          "mt-8 inline-flex items-center gap-2 text-sm font-semibold hover:underline",
                          accentText,
                        )}
                      >
                        {isFr ? "Découvrir cette intervention" : "Discover this service"}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                </FadeInOnView>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ───────────── LOGOS CLIENTS — header retiré (polish v8 Will) ─────────────
          Juste les 17 logos, pas de eyebrow/title/caption. Box normalisée
          dans LogosMarquee pour que tous les logos paraissent à la même
          taille visuelle (object-contain dans container fixe). */}
      <section className="bg-bg border-border border-t border-b py-12 sm:py-16">
        <Container>
          <LogosMarquee logos={CLIENT_LOGOS} />
        </Container>
      </section>

      {/* ───────────── BANDEAU ÉQUIPE 4 PHOTOS — full-bleed ─────────────
          Hors Container pour aller bord-à-bord sans cadre blanc latéral. */}
      <section className="bg-bg">
        <Image
          src="/illustrations/home-bandeau-team.png"
          alt={
            isFr
              ? "Bandeau Axion-IA.com — quatre scènes de coworking de l'équipe : démo écran, échange canapé, session laptop binôme, portrait souriant."
              : "Axion-IA.com banner — four team coworking scenes: screen demo, sofa exchange, paired laptop session, smiling portrait."
          }
          width={1961}
          height={802}
          loading="lazy"
          decoding="async"
          sizes="100vw"
          className="h-auto w-full"
        />
      </section>

      {/* ───────────── SECTION FONDATEUR (crédibilité + "Top 1 %") ─────────────
          Insérée après le bandeau équipe. Adapte le design "Fondateur &
          CEO" de l'exemple : eyebrow + headline 2 lignes + description +
          tagline italic / photo dirigeant + stats bar 3 colonnes.
          Photo placeholder : drop `public/illustrations/home-founder-william.jpg`. */}
      <section className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Colonne gauche : copy */}
              <div className="max-w-xl">
                <p className="text-fg-muted mb-6 text-[12px] font-semibold tracking-[0.2em] uppercase">
                  <span className="bg-terracotta mr-2.5 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                  {t("founderEyebrow")}
                </p>
                <h2
                  className="text-fg text-[clamp(2.5rem,5vw,4.25rem)] leading-[1.02] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("founderTitleLine1")}
                  <br />
                  <span className="text-terracotta italic">{t("founderTitleLine2")}</span>
                </h2>
                <p className="text-fg-soft mt-7 text-lg leading-relaxed">
                  {t("founderDescription")}
                </p>
                <div className="border-border-strong mt-8 flex items-start gap-4 border-t pt-6">
                  <span className="bg-terracotta mt-1 inline-block h-6 w-0.5 shrink-0 rounded-full" />
                  <p
                    className="text-fg-soft text-base leading-relaxed italic"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {t("founderTagline")}
                  </p>
                </div>
              </div>

              {/* Colonne droite : carte fondateur */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs">
                  <Illustration
                    slot="HOME-04-founder"
                    src="/illustrations/home-founder-william.jpg"
                    aspectRatio="4:5"
                    filenameTarget="public/illustrations/home-founder-william.jpg"
                    caption={
                      isFr
                        ? "William J. — Fondateur & CEO Axion-IA"
                        : "William J. — Founder & CEO Axion-IA"
                    }
                    alt={t("founderPhotoAlt")}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-fg text-lg font-semibold">{t("founderName")}</p>
                    <p className="text-fg-muted text-sm">{t("founderRole")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats bar — 3 colonnes séparées par des dividers verticaux */}
            <div
              className="border-border-strong mt-16 grid grid-cols-3 divide-x border-t pt-10"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              {(
                [
                  { number: t("founderStat1Number"), label: t("founderStat1Label") },
                  { number: t("founderStat2Number"), label: t("founderStat2Label") },
                  { number: t("founderStat3Number"), label: t("founderStat3Label") },
                ] as const
              ).map((stat, idx) => (
                <div key={idx} className="flex flex-col gap-1 px-6 first:pl-0 last:pr-0">
                  <span
                    className="text-fg text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {stat.number}
                  </span>
                  <span className="text-fg-soft text-sm leading-snug">{stat.label}</span>
                </div>
              ))}
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ─────────────── DÉMOS VISUELLES — 2 images sur la même ligne ──────────────
          Remplace l'ancienne section métriques chiffrées. Deux captures concrètes
          du produit Axion-IA : pipeline lead (7 étapes auto) + planning Gantt
          IA temps réel. Côte à côte sur desktop, empilées sur mobile. */}
      <section className="bg-paper py-20 sm:py-24 lg:py-28">
        <Container>
          <FadeInOnView>
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
              <figure className="border-border overflow-hidden rounded-2xl border">
                <Image
                  src="/images/axion-ia-pipeline-lead-ia-zero-intervention-humaine-7-etapes-banniere.png"
                  alt={
                    isFr
                      ? "Pipeline Axion-IA : 7 étapes automatisées du formulaire entrant au CRM (scoring IA, enrichissement, segmentation chaud/tiède/froid, routage)."
                      : "Axion-IA pipeline: 7 automated steps from incoming form to CRM (AI scoring, enrichment, hot/warm/cold segmentation, routing)."
                  }
                  width={1600}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="h-auto w-full"
                />
              </figure>
              <figure className="border-border overflow-hidden rounded-2xl border">
                <Image
                  src="/images/axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere.png"
                  alt={
                    isFr
                      ? "Planning Gantt Axion-IA : chantier Résidence Les Pins, 15 tâches, conflits de ressources détectés automatiquement, alertes météo."
                      : "Axion-IA Gantt planning: Résidence Les Pins worksite, 15 tasks, automatically detected resource conflicts, weather alerts."
                  }
                  width={1600}
                  height={900}
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="h-auto w-full"
                />
              </figure>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── 4 ATOUTS EN STRIP (Why simplifié) ─────────────
          Strip horizontale sans photo (le bandeau au-dessus apporte le
          visuel). 4 atouts ultra-courts (1 ligne chacun). */}
      <section className="bg-halo-cool py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <p className="text-fg-muted mb-10 text-center text-[13px] font-semibold tracking-[0.18em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              {t("valueWhyEyebrow")}
            </p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {whyPoints.map((point, idx) => (
                <li
                  key={idx}
                  className="bg-paper border-border flex flex-col gap-3 rounded-2xl border p-6"
                >
                  <span
                    className="text-terracotta text-3xl font-medium tabular-nums"
                    style={{ fontFamily: "var(--font-serif)" }}
                    aria-hidden="true"
                  >
                    0{idx + 1}
                  </span>
                  <span className="text-fg text-base leading-snug">{point}</span>
                </li>
              ))}
            </ul>
          </FadeInOnView>
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

      {/* ───────────── CTA CONTACT — après cas clients ─────────────
          Après avoir vu des résultats concrets, inciter à passer à l'action.
          Section courte, directe, lien vers /contact (formulaire existant). */}
      <section className="bg-terracotta py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-2xl">
                <h2
                  className="text-paper text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr
                    ? "Votre projet mérite une réponse concrète."
                    : "Your project deserves a concrete answer."}
                </h2>
                <p className="text-paper/85 mt-3 text-base leading-relaxed sm:text-lg">
                  {isFr
                    ? "Décrivez votre situation en 2 minutes. On revient vers vous sous 24h avec une analyse honnête, sans engagement."
                    : "Describe your situation in 2 minutes. We'll get back to you within 24h with an honest analysis, no commitment."}
                </p>
              </div>
              <Link
                href="/contact"
                className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 shrink-0 items-center gap-2 rounded-full px-8 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {isFr ? "Nous contacter" : "Contact us"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </FadeInOnView>
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

      {/* ───────────── BÉNÉFICES (ancienne image HOME-03 recréée en code) ─────────────
          Layout fidèle à la bannière : logo gauche / bénéfices droite / tagline bas. */}
      <section className="bg-paper py-16 sm:py-20">
        <Container>
          <FadeInOnView>
            <div className="border-border mx-auto max-w-5xl overflow-hidden rounded-3xl border">
              {/* Corps 2 colonnes */}
              <div className="grid lg:grid-cols-[1fr_2px_1.6fr]">
                {/* Colonne gauche : branding */}
                <div className="flex items-center justify-center px-10 py-16 lg:py-20">
                  <div className="text-center">
                    <p
                      className="text-fg text-[clamp(3rem,6vw,5rem)] leading-none font-bold tracking-tight"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      Axion-<span className="text-terracotta">IA</span>
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="bg-terracotta block h-px w-10" />
                      <p className="text-fg text-xl font-medium tracking-wide">.com</p>
                      <span className="bg-terracotta block h-px w-10" />
                    </div>
                  </div>
                </div>

                {/* Séparateur vertical */}
                <div className="bg-border hidden lg:block" />

                {/* Colonne droite : headline + 4 bénéfices */}
                <div className="px-10 py-10 lg:py-14">
                  <h2
                    className="text-fg text-[clamp(1.6rem,2.5vw,2.25rem)] leading-[1.15] font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Des <span className="text-terracotta italic">bénéfices</span> concrets,
                    <br />
                    mesurables, durables.
                  </h2>
                  <span className="bg-terracotta mt-4 mb-8 block h-0.5 w-10" />
                  <ul className="flex flex-col gap-6">
                    {[
                      {
                        Icon: TrendingUp,
                        title: isFr ? "GAIN DE TEMPS" : "TIME SAVINGS",
                        desc: isFr
                          ? "Automatisez les tâches répétitives et concentrez-vous sur l'essentiel."
                          : "Automate repetitive tasks and focus on what matters.",
                      },
                      {
                        Icon: Target,
                        title: isFr ? "MEILLEURE PRISE DE DÉCISION" : "BETTER DECISION-MAKING",
                        desc: isFr
                          ? "Exploitez la puissance des données pour des décisions plus éclairées."
                          : "Harness the power of data for more informed decisions.",
                      },
                      {
                        Icon: Lightbulb,
                        title: isFr ? "INNOVATION ACCÉLÉRÉE" : "ACCELERATED INNOVATION",
                        desc: isFr
                          ? "Libérez votre créativité et votre capacité d'innovation grâce à l'IA."
                          : "Unlock your creativity and innovation capacity through AI.",
                      },
                      {
                        Icon: Star,
                        title: isFr ? "PERFORMANCE DURABLE" : "LASTING PERFORMANCE",
                        desc: isFr
                          ? "Améliorez vos résultats tout en renforçant l'engagement et la satisfaction."
                          : "Improve results while strengthening engagement and satisfaction.",
                      },
                    ].map(({ Icon, title, desc }) => (
                      <li key={title} className="flex items-start gap-4">
                        <span className="border-terracotta text-terracotta flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-fg text-[11px] font-bold tracking-[0.15em] uppercase">
                            {title}
                          </p>
                          <p className="text-fg-soft mt-1 text-sm leading-relaxed">{desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Tagline bas */}
              <div className="border-border border-t py-5 text-center">
                <p className="text-fg-muted text-[11px] font-semibold tracking-[0.22em] uppercase">
                  {isFr ? "Comprendre. Former. Transformer." : "Understand. Train. Transform."}
                </p>
              </div>
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
