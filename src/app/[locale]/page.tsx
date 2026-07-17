import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  TrendingUp,
  Target,
  Star,
  Users,
  Layers,
  MapPin,
  BadgeCheck,
  Shield,
  Clock,
  Sparkles,
} from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { getPublishedReviews, getAggregateRating } from "@/server/reviews/queries";
import { orgAggregateJsonLd } from "@/server/reviews/jsonld";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { HomeReviewsCarousel } from "@/components/home/HomeReviewsCarousel";
import { SERVICE_BY_ID, serviceNavShort, serviceOfficial } from "@/content/services";
import { FAQ_GLOBAL } from "@/content/transversal";
import { VIDEO_TESTIMONIALS, SECTORS } from "@/content/home-data";
import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  formatAmount,
  getEntryPriceEur,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildFaqSpeakableJsonLd,
  buildLocalBusinessJsonLd,
  buildPageImageGraphJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FadeInOnView } from "@/components/motion/FadeInOnView";
import { ServicesGrid } from "@/components/services/ServicesGrid";
import { Illustration } from "@/components/visual/Illustration";
import { ClientLogosStrip } from "@/components/home/ClientLogosStrip";
import { QualiopiBadge } from "@/components/qualiopi/QualiopiBadge";
import { VideoTestimonials } from "@/components/home/VideoTestimonials";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";

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
  const titleStr = isFr
    ? "Cabinet IA France · Formations · Audits · Axion-IA"
    : "AI Consultancy France · Training · Audits · Axion-IA";
  return {
    ...buildProductMetadata({
      locale,
      path: "/",
      title: titleStr,
      description: isFr
        ? // Claim Qualiopi/OPCO gaté Phase B (fuyait en SERP, flag purgé 2026-07-14).
          isQualiopiPublicDisclosureEnabled()
          ? "Formations IA finançables OPCO, certifié Qualiopi. Audits, coaching 1-to-1, automatisation. Vos équipes gagnent du temps dès le lendemain de l'intervention entreprise."
          : "Formations IA en entreprise, audits, coaching 1-to-1, automatisation. Vos équipes gagnent du temps dès le lendemain de l'intervention, partout en France."
        : `Senior-only AI consultancy, zero middlemen. Audits, training, 1-to-1 coaching, implementations for SMBs. Measurable results, EU hosting, from ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "en", { compact: true })}.`,
      alternates: { fr: "/", en: "/" },
    }),
    title: { absolute: titleStr },
  };
}

export default async function Home({ params }: HomeProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const t = await getTranslations("home");

  // Avis clients RÉELS (customer_reviews) pour la section témoignages de la home —
  // remplace les anciennes citations fabriquées (CASE_STUDIES + photos Unsplash +
  // note « 4,9/5 » factice). `featured` d'abord, puis récents. `homeReviewsOrgAgg`
  // ré-active honnêtement l'AggregateRating JSON-LD (gaté ≥ 5 avis publiés).
  const [homeReviews, homeReviewsAgg] = await Promise.all([
    getPublishedReviews({ sort: "featured", pageSize: 9 }),
    getAggregateRating({}),
  ]);
  const homeReviewsOrgAgg = orgAggregateJsonLd(homeReviewsAgg);

  // Badge sous le bandeau logos : nombre d'avis « top » affiché en dynamique.
  // On ne retient que les 4★ et 5★ pour que le badge « Excellent » reste
  // honnête à mesure que de nouveaux avis arrivent (demande Will 2026-07-10).
  const homeTopReviewCount = homeReviewsAgg
    ? homeReviewsAgg.breakdown[4] + homeReviewsAgg.breakdown[5]
    : null;

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
  // auditRange retiré post-refonte pricing single-block 2026-05-24
  // (la grille utilise désormais auditEntryPrice + "à partir de" plutôt qu un range).
  // Préservé en commentaire pour réintroduction facile si Will veut revenir à un affichage range :
  //   const auditRange = formatAmountRange(getEntryPriceEur(AUDIT_TIERS) ?? 0,
  //     getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!, loc, { compact: true });
  const auditEntryPrice = formatAmount(getEntryPriceEur(AUDIT_TIERS) ?? 0, loc, {
    compact: true,
  });
  const unAUnEntryPrice = formatAmount(getEntryPriceEur(UN_A_UN_TIERS) ?? 0, loc, {
    compact: true,
  });
  // Plateforme web augmentée IA : pas de TIERS dédié dans pricing.ts SSOT
  // → on s'aligne sur le prix d'entrée implémentation (porte d'entrée la
  // plus proche en coût/durée). Will pourra ajouter un WEB_TIERS dédié plus tard.
  const webEntryPrice = implEntryPrice;

  // 5 services — Blueprint 2026 (Section 4) : Formations / 1-to-1 / Audits /
  // Implémentations / Plateforme web & SaaS.
  // Refonte cartes 2026-05-24 (Will) : charte brand stricte (terracotta dominant,
  // bleu uniquement pointes), titres XL serif impactants, offre claire.
  // Plus de rotation accents — brand-coherence avant tout (ces 5 cartes = CA).
  // `shortName` = troncature `navShort` du SSOT `src/content/services.ts`
  // (titre de carte court, cohérent avec le header). `official` = nom officiel
  // complet, réservé au JSON-LD Service (signal AEO/SEO). Ne PAS réintroduire de
  // libellé de service en dur ici.
  const valuePropositions = [
    {
      id: "intervene",
      emoji: "🎓",
      shortName: serviceNavShort(SERVICE_BY_ID.formations, isFr),
      official: serviceOfficial(SERVICE_BY_ID.formations, isFr),
      tagline: isFr ? "IA en entreprise" : "AI for companies",
      headline: t("value1Headline"),
      priceLabel: isFr
        ? `À partir de ${interventionEntryPrice} HT`
        : `From ${interventionEntryPrice} excl. tax`,
      gain: t("value1Gain"),
      href: "/formations" as const,
    },
    {
      id: "coach",
      emoji: "🧑‍💼",
      shortName: serviceNavShort(SERVICE_BY_ID.unAUn, isFr),
      official: serviceOfficial(SERVICE_BY_ID.unAUn, isFr),
      tagline: isFr ? "Accompagnement individuel" : "Personal support",
      headline: t("value4Headline"),
      priceLabel: isFr ? `À partir de ${unAUnEntryPrice} HT` : `From ${unAUnEntryPrice} excl. tax`,
      gain: t("value4Gain"),
      href: "/un-a-un" as const,
    },
    {
      id: "audit",
      emoji: "🔍",
      shortName: serviceNavShort(SERVICE_BY_ID.audit, isFr),
      official: serviceOfficial(SERVICE_BY_ID.audit, isFr),
      tagline: isFr ? "Diagnostic & roadmap" : "Diagnosis & roadmap",
      headline: t("value2Headline"),
      priceLabel: isFr ? `À partir de ${auditEntryPrice} HT` : `From ${auditEntryPrice} excl. tax`,
      gain: t("value2Gain"),
      href: "/audit" as const,
    },
    {
      id: "implement",
      emoji: "⚙️",
      shortName: serviceNavShort(SERVICE_BY_ID.implementation, isFr),
      official: serviceOfficial(SERVICE_BY_ID.implementation, isFr),
      tagline: isFr ? "Automatisations sur mesure" : "Custom automation",
      headline: t("value3Headline"),
      priceLabel: isFr ? `À partir de ${implEntryPrice} HT` : `From ${implEntryPrice} excl. tax`,
      gain: t("value3Gain"),
      href: "/implementation" as const,
    },
    {
      id: "web",
      emoji: "🌐",
      shortName: serviceNavShort(SERVICE_BY_ID.sitesWeb, isFr),
      official: serviceOfficial(SERVICE_BY_ID.sitesWeb, isFr),
      tagline: isFr ? "Sites & apps augmentés IA" : "AI-augmented sites & apps",
      headline: t("value5Headline"),
      priceLabel: isFr ? `À partir de ${webEntryPrice} HT` : `From ${webEntryPrice} excl. tax`,
      gain: t("value5Gain"),
      href: "/sites-web-augmentes" as const,
    },
  ];

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

  // ─── FAQ — sélection home (12 questions essentielles + 4 géo) ───
  // FAQ_GLOBAL contient ~30+ questions exhaustives. Sur la home, on affiche
  // un sous-ensemble pertinent pour ne pas surcharger la page :
  // 4 géo (couverture France/international) + 8 essentielles (définition,
  // démarrage, coût, ROI, sécurité, délai, IA vs équipes, AI Act).
  // Le reste est accessible via /faq (page dédiée).
  const HOME_FAQ_IDS = [
    "geo-france",
    "geo-metropoles",
    "geo-tpe-rural",
    "geo-distance-international",
    "definition-axion-ia",
    "comment-commencer",
    "delai-implementation",
    "cout-projet-ia-pme",
    "ia-remplace-salaries",
    "confidentialite-projet-ia",
    "roi-mesurer",
    "ai-act-2026",
  ] as const;
  const faqs = HOME_FAQ_IDS.map((id) => FAQ_GLOBAL.find((f) => f.id === id))
    .filter((f): f is (typeof FAQ_GLOBAL)[number] => f !== undefined)
    .map((f) => ({
      id: f.id,
      question: f[loc].question,
      answer: f[loc].answer,
    }));

  // JSON-LD homepage. Organization déjà émis layout-level via
  // `buildOrganizationJsonLd` (riche : sameAs + contactPoint + areaServed +
  // foundingLocation + knowsLanguage). Pas de re-émission ici (signal Google
  // "double Organization" ambigu). Le FAQ utilise `buildFaqSpeakableJsonLd`
  // pour activer la voix (Google Assistant + Alexa + Bixby — AEO 2026).
  // `additionalSelectors` étend la couverture Speakable au hero (h1 + intro)
  // pour que voice search lise le brand statement avant les Q+R (cf. audit P1-1
  // 2026-05-24 : sans ça, Google Assistant ne lit que la FAQ, jamais le hero).
  const faqJsonLd = buildFaqSpeakableJsonLd({
    items: faqs,
    additionalSelectors: ["[data-speakable-hero]"],
  });

  // LocalBusiness JSON-LD — Service Area Business safe mode.
  // Pas d'adresse/geo/openingHours sur la home (juste areaServed France).
  // Les vrais champs (adresse Paris) iront sur /a-propos quand prêts.
  const localBusinessJsonLd = buildLocalBusinessJsonLd({
    locale: loc,
    path: "/",
    name: isFr ? "Axion-IA — Cabinet IA opérationnel" : "Axion-IA — Operational AI Consultancy",
    description: isFr
      ? "Cabinet IA français : formations, audits, accompagnement 1-to-1, implémentations d'automatisations, plateformes web augmentées IA. Présent partout en France métropolitaine."
      : "French AI consultancy: training, audits, 1-to-1 coaching, automation implementation, AI-augmented web platforms. Present across mainland France.",
    areaServed: { type: "AdministrativeArea", name: isFr ? "France" : "France" },
  });

  // ─── JSON-LD additionnels Blueprint §22 ───
  // 1) Service x5 — un objet @type Service par card du tableau valuePropositions
  //    (Blueprint §22 → 1 Service par service public). Provider référence
  //    l'Organization déjà émise layout-level (pas de re-émission complète).
  const SERVICE_PATHS: Record<string, string> = {
    intervene: "/formations",
    audit: "/audit",
    coach: "/un-a-un",
    implement: "/implementation",
    web: "/sites-web-augmentes",
  };
  // Service x5 — provider référence l'Organization émise layout-level via @id
  // (knowledge graph LLM-friendly : Organization → Service → Offer cohérent vs
  // chaque Service îlot avec provider string dupliqué). Cf. audit AEO 2026-05-24.
  // name / serviceType : nom OFFICIEL complet du SSOT (signal AEO/SEO précis),
  // pas la troncature d'affichage `shortName` des cartes.
  const servicesJsonLd = valuePropositions.map((v) => ({
    "@context": "https://schema.org",
    "@type": "Service" as const,
    name: `${v.official} · ${v.tagline}`,
    description: v.gain,
    provider: { "@id": `${SITE_URL}/#organization` },
    areaServed: "FR",
    serviceType: v.official,
    url: `${SITE_URL}${SERVICE_PATHS[v.id] ?? "/"}`,
  }));

  // 2) Témoignages home = désormais les VRAIS avis clients (customer_reviews,
  // fetchés plus haut). L'AggregateRating JSON-LD, retiré en mai 2026 faute de
  // ≥ 5 vrais avis datés, est ré-activé via `homeReviewsOrgAgg` (gaté ≥ 5).

  // BreadcrumbList JSON-LD : ABSENT volontairement sur la home (convention 2026 :
  // la home EST la racine hiérarchique → un BL self-referencing 1-item est un
  // anti-pattern Google. Les pages enfants émettent leur BL via buildBreadcrumbJsonLd).
  // Cf. audit perfection A4 2026-05-24.

  // ImageObject @graph — Sprint perfection AEO 2026-05-28 (Will). Exposition
  // Google Images / Bing / Pinterest + citation AI Overviews / Perplexity /
  // Claude Vision. 3 images stratégiques de la home (hero équipe, bandeau
  // équipe full-bleed, portrait fondateur). Factory centralisée.
  const homeImagesJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/" });

  // 3) VideoObject[] — un schema par vidéo témoignage. Vide si pas de vidéos
  //    (section masquée côté JSX → schema absent aussi, cohérent).
  //    `datePublished` requis sur VideoTestimonial pour signal fraîcheur honnête.
  const videosJsonLd = VIDEO_TESTIMONIALS.map((v) => ({
    "@context": "https://schema.org",
    "@type": "VideoObject" as const,
    name: v.title,
    description: `« ${v.quote} » — ${v.author}, ${v.role}, ${v.company}`,
    thumbnailUrl: v.thumbnail ?? `https://i.ytimg.com/vi/${v.youtubeId}/maxresdefault.jpg`,
    uploadDate: v.datePublished,
    ...(v.duration ? { duration: v.duration } : {}),
    contentUrl: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}`,
  }));

  return (
    <>
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HERO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="bg-halo-warm relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-32"
      >
        <Container className="relative">
          {/* Badge pastille centré sur la page (demande Will 2026-07-10) —
              drapeau + positionnement N°1, au-dessus de la grille 2 colonnes. */}
          <HeroBadge className="mb-10 sm:mb-12">
            <span aria-hidden="true">🇫🇷</span>
            {t("heroEyebrow")}
          </HeroBadge>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche : copy (titre garde sa taille géante) */}
            <div className="max-w-2xl">
              <h1 id="hero-heading" className="display-editorial text-fg" data-speakable-hero>
                {t("heroTitlePart1")}{" "}
                <em className="italic-editorial text-terracotta not-italic">
                  <span className="italic">{t("heroTitleEm")}</span>
                </em>
                {t("heroTitlePart2")}
              </h1>
              <p
                className="text-fg-soft mt-8 max-w-2xl text-lg leading-relaxed sm:text-xl"
                data-speakable-hero
              >
                {t("heroDescription")}
              </p>
              {/* Hero CTAs (2026-05-23 Will) : 2 boutons côte à côte
                  — Primary : échanger 30 min sans engagement (/appel, widget Calendly)
                  — Secondary : formulaire de contact (/contact, réponse 24h) */}
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/appel"
                  className="bg-terracotta text-paper cta-lift focus-visible:ring-terracotta inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr
                    ? "Je veux réserver un appel pour me renseigner"
                    : "I want to book a call to learn more"}
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
              {/* Chips bénéfices (remplacent l'ancienne proof-line) — calées sur
                  le rendu de référence : puces à pastille terracotta. */}
              <ul className="text-fg-soft mt-8 flex flex-col gap-x-6 gap-y-2.5 text-sm font-medium sm:flex-row sm:flex-wrap sm:items-center sm:text-base">
                {[t("heroChip1"), t("heroChip2"), t("heroChip3")].map((chip) => (
                  <li key={chip} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="bg-terracotta inline-block h-2 w-2 shrink-0 rounded-full"
                    />
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Colonne droite : photo hero placeholder. Will drop l'image
                réelle (dashboard / livrable Axion-IA / capture produit) dans
                `public/illustrations/home-hero-dashboard.avif`. Ratio 3:2 calé
                sur le fichier source (1536×1024) → 0 CLS + 0 distorsion
                (Lighthouse image-aspect-ratio). */}
            <div className="hidden lg:block">
              <Illustration
                slot="HOME-01-hero"
                src="/illustrations/home-hero-equipe.avif"
                aspectRatio="3:2"
                filenameTarget="public/illustrations/home-hero-equipe.avif"
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
      <section
        id="services"
        aria-labelledby="services-heading"
        className="bg-paper relative py-20 sm:py-24 lg:py-28"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-14 max-w-5xl text-center">
              <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
                {t("valueEyebrow")}
              </p>
              <h2
                id="services-heading"
                className="text-fg text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.98] font-semibold tracking-tight"
              >
                {t("valueTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("valueTitleEm")}
                </span>
                {t("valueTitlePart2")}
              </h2>
              <p className="text-fg-soft mx-auto mt-6 max-w-3xl text-lg leading-relaxed sm:text-xl">
                {t("valueDescription")}
              </p>
            </div>
          </FadeInOnView>

          {/* 5 cartes services — grille CENTRALISÉE (ServicesGrid, variante
              `showcase`). Depuis 2026-07-06, icône + couleur d'accent par service
              viennent de la SSOT `services-visual.ts` (« pep par activité » : chaque
              service a SA teinte), et largeur/hauteur/hover/focus sont partagés avec
              /visibilite-entreprise et /presse. Le contenu (tagline, prix, CTA) reste
              propre à la home, injecté via renderBody. `valuePropositions` (ordre =
              SERVICES) alimente aussi le JSON-LD Service plus haut — ne pas retirer. */}
          <ServicesGrid
            variant="showcase"
            isFr={isFr}
            renderBody={({ index, accent }) => {
              const v = valuePropositions[index];
              if (!v) return null;
              return (
                <>
                  <p className={cn("mt-1 text-sm font-semibold tracking-tight", accent.text)}>
                    {v.tagline}
                  </p>
                  {/* Description courte */}
                  <p className="text-fg-soft mt-4 text-sm leading-relaxed">{v.headline}</p>
                  {/* Prix d entrée — signal CA direct */}
                  <p
                    className="text-fg mt-5 text-base font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {v.priceLabel}
                  </p>
                  {/* Spacer flex */}
                  <div className="flex-1" />
                  {/* CTA Découvrir — teinté à l'accent du service. Séparateur en
                      hairline neutre (border-fg/10) : lisible sur toute teinte de fond. */}
                  <span
                    className={cn(
                      "border-fg/10 mt-6 inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold transition-colors",
                      accent.text,
                    )}
                  >
                    {t("valueCardCta")}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </>
              );
            }}
          />
        </Container>
      </section>

      {/* ───────────── LOGOS CLIENTS — défilement 1 ligne + note terracotta ─────────────
          Bandeau de logos sur une seule ligne qui défile (ClientLogosStrip),
          suivi du badge « Excellent ★★★★★ {N} avis » avec le nombre d'avis
          dynamique (note ≥ 4★). Pleine largeur (fades latéraux) → pas de
          Container ici. */}
      <section
        id="clients"
        aria-label={isFr ? "Nos clients" : "Our clients"}
        className="bg-bg border-border border-t border-b py-12 sm:py-16"
      >
        <ClientLogosStrip isFr={isFr} reviewCount={homeTopReviewCount} />
      </section>

      {/* ───────────── BANDEAU ÉQUIPE 4 PHOTOS — full-bleed ─────────────
          Hors Container pour aller bord-à-bord sans cadre blanc latéral. */}
      <section className="bg-bg">
        <Image
          src="/illustrations/home-bandeau-team.avif"
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
          Photo placeholder : drop `public/illustrations/home-founder-william.avif`. */}
      <section
        id="founder"
        aria-labelledby="founder-heading"
        className="bg-paper border-border border-t py-20 sm:py-24 lg:py-28"
      >
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
                  id="founder-heading"
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
                {/* Lien contextuel /a-propos (audit P0-4 internal linking 2026-05-24) */}
                <p className="mt-6">
                  <Link
                    href="/a-propos"
                    className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {isFr ? "Découvrir notre approche complète" : "Discover our full approach"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </p>
              </div>

              {/* Colonne droite : carte fondateur */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-xs">
                  <Illustration
                    slot="HOME-04-founder"
                    src="/illustrations/home-founder-william.avif"
                    aspectRatio="4:5"
                    filenameTarget="public/illustrations/home-founder-william.avif"
                    caption={
                      isFr
                        ? "Williams — Fondateur & CEO Axion-IA"
                        : "Williams — Founder & CEO Axion-IA"
                    }
                    alt={t("founderPhotoAlt")}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-fg text-lg font-semibold">{t("founderName")}</p>
                    <p className="text-fg-muted text-sm">{t("founderRole")}</p>
                    {/* Lien vers la fiche d'autorité d'entité `/equipe/williams`
                        (E-E-A-T / Knowledge Panel — audit 2026-07-06). FR only
                        (page servie uniquement en FR). */}
                    {isFr ? (
                      <p className="mt-2">
                        <Link
                          href={{ pathname: "/equipe/[slug]", params: { slug: "williams" } }}
                          className="text-terracotta hover:text-terracotta-deep text-sm font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          Voir le profil du fondateur
                        </Link>
                      </p>
                    ) : null}
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

      {/* ─────────────── POURQUOI AXION-IA — design éditorial v2 ───────────────
          Refonte from-scratch (Will 2026-05-23) : hiérarchie claire en 4 blocs
          visuels distincts au lieu d'une infographie compacte surchargée.
          1. Header (eyebrow + h2 + lead)
          2. 6 différenciateurs en grid 3×2 éditoriale (numéros géants serif)
          3. Modularité — 6 capacités en bandeau horizontal (sans répétition)
          4. Trust signals + tagline finale */}
      <section
        id="why"
        aria-labelledby="why-heading"
        className="bg-halo-cool relative py-24 sm:py-28 lg:py-32"
      >
        <Container>
          {/* BLOC 1 — Header */}
          <FadeInOnView>
            <div className="mx-auto mb-20 max-w-3xl text-center sm:mb-24">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Ce qui nous distingue" : "What sets us apart"}
              </p>
              <h2
                id="why-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
                {isFr ? "Six raisons concrètes" : "Six concrete reasons"}
                <br />
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "de nous choisir" : "to choose us"}
                </span>
                .
              </h2>
              <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "Chaque expertise est autonome — combinable avec les autres ou prise seule. C'est vous qui choisissez selon vos besoins."
                  : "Each expertise stands alone — combinable with the others or taken solo. You choose based on your needs."}
              </p>
            </div>
          </FadeInOnView>

          {/* BLOC 2 — 6 différenciateurs COMPACTS (refonte 2026-05-24 Will :
              avant = grid 3×2 énorme avec hero bands colorés rainbow + numéros
              géants + accent ribbons → trop massif. Maintenant : grid 3×2 dense,
              card simple icon + titre + 1 phrase, brand-coherent terracotta).
              BLOC 3 "Modulaire par design" SUPPRIMÉ (redondant : la modularité
              est déjà dans la description de section + une carte "De A à Z"). */}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {(
              [
                {
                  Icon: Users,
                  titleFr: "Zéro intermédiaire",
                  titleEn: "Zero middleman",
                  descFr:
                    "Formateurs, auditeurs, développeurs, implémenteurs — tous seniors expérimentés.",
                  descEn: "Trainers, auditors, developers, implementers — all seasoned seniors.",
                },
                {
                  Icon: Layers,
                  titleFr: "De A à Z",
                  titleEn: "End-to-end",
                  descFr:
                    "Formation, audit, 1-to-1, automatisation, plateforme — un seul interlocuteur.",
                  descEn: "Training, audit, 1-to-1, automation, platform — one single contact.",
                },
                {
                  Icon: MapPin,
                  titleFr: "Partout en France et dans la francophonie",
                  titleEn: "Partout en France et dans la francophonie",
                  descFr:
                    "13 régions métropolitaines, 5 DROM, entreprises francophones à l'étranger — sur site ou à distance, selon le contexte.",
                  descEn:
                    "13 régions métropolitaines, 5 DROM, entreprises francophones à l'étranger — sur site ou à distance, selon le contexte.",
                },
                {
                  Icon: BadgeCheck,
                  titleFr: "Vous parlez au senior",
                  titleEn: "You talk to the senior",
                  descFr:
                    "Pas à un commercial, pas à un junior. Directement à celui qui fait le travail.",
                  descEn: "Not to sales, not to a junior. Directly to the person doing the work.",
                },
                {
                  Icon: Target,
                  titleFr: "Vous êtes au centre",
                  titleEn: "You're at the center",
                  descFr:
                    "Votre projet, votre rythme, votre contexte. On s'adapte à vous — jamais l'inverse.",
                  descEn:
                    "Your project, your pace, your context. We adapt to you — never the reverse.",
                },
                {
                  Icon: Sparkles,
                  titleFr: "Exigence senior absolue",
                  titleEn: "Strict senior standards",
                  descFr:
                    "Résultats mesurables. Même niveau pour un artisan que pour un grand groupe.",
                  descEn: "Measurable results. Same level for a craftsman or a large group.",
                },
              ] as const
            ).map((card, idx) => (
              <li
                key={card.titleFr}
                className="bg-paper border-border hover:border-terracotta hover:shadow-subtle group flex h-full items-start gap-4 rounded-2xl border p-5 transition-all duration-300 sm:p-6"
              >
                <FadeInOnView delay={idx * 40}>
                  <span
                    className="bg-terracotta-soft text-terracotta-deep inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
                    aria-hidden="true"
                  >
                    <card.Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-fg text-base leading-tight font-bold tracking-tight sm:text-lg">
                      {isFr ? card.titleFr : card.titleEn}
                    </h3>
                    <p className="text-fg-soft mt-1.5 text-sm leading-relaxed">
                      {isFr ? card.descFr : card.descEn}
                    </p>
                  </div>
                </FadeInOnView>
              </li>
            ))}
          </ul>

          {/* BLOC 4 — Trust signals (3 colonnes inline) + tagline finale */}
          <FadeInOnView>
            <div className="border-border mt-20 grid gap-8 border-t pt-12 sm:mt-24 sm:grid-cols-3 sm:gap-10">
              {(
                [
                  {
                    Icon: Shield,
                    titleFr: "Sécurité & confidentialité",
                    titleEn: "Security & confidentiality",
                    descFr: "Vos données sont protégées. Votre confidentialité est notre priorité.",
                    descEn: "Your data is protected. Confidentiality is our priority.",
                  },
                  {
                    Icon: TrendingUp,
                    titleFr: "Résultats mesurables",
                    titleEn: "Measurable results",
                    descFr: "Des objectifs clairs, des indicateurs précis, un impact concret.",
                    descEn: "Clear goals, precise indicators, concrete impact.",
                  },
                  {
                    Icon: Clock,
                    titleFr: "Accompagnement dans la durée",
                    titleEn: "Long-term support",
                    descFr: "Un partenaire fiable, présent à chaque étape de votre croissance.",
                    descEn: "A reliable partner at every stage of your growth.",
                  },
                ] as const
              ).map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 text-center sm:text-left">
                  <span className="text-terracotta inline-flex h-10 w-10 items-center justify-center self-center sm:self-start">
                    <item.Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2} />
                  </span>
                  <h4 className="text-fg text-base font-bold tracking-tight">
                    {isFr ? item.titleFr : item.titleEn}
                  </h4>
                  <p className="text-fg-soft text-sm leading-relaxed">
                    {isFr ? item.descFr : item.descEn}
                  </p>
                </div>
              ))}
            </div>

            {/* Réassurance Qualiopi (Phase B) — centrée sous les trust signals,
                hors zone LCP du hero. Pastille texte seul, null hors Phase B. */}
            <div className="mt-10 flex justify-center sm:mt-12">
              <QualiopiBadge variant="inline" />
            </div>

            {/* Tagline finale — pleine largeur centrée, serif italic */}
            <p
              className="text-fg-muted mx-auto mt-16 max-w-3xl text-center text-lg leading-relaxed sm:mt-20 sm:text-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr
                ? "Une vision. Une équipe. Une méthode. Un seul objectif : "
                : "One vision. One team. One method. One goal: "}
              <span className="text-terracotta font-semibold italic">
                {isFr ? "votre réussite." : "your success."}
              </span>
            </p>
          </FadeInOnView>
        </Container>
      </section>

      {/* ─────────────── GRILLE TARIFAIRE — TABLEAU SINGLE-BLOCK 5 SERVICES ───────────────
          Refonte (Will 2026-05-24 v2) : un seul bloc moderne avec les 5 services
          dans un tableau aligné. Plus dense, plus lisible, plus pro qu'un grid 3 cards.
          Prix dérivés du SSOT pricing.ts (interventionEntry/auditFlash/unAUn/impl/web).
          Mobile : cartes empilées. Desktop : table row + colonnes (SERVICE / CATÉGORIE / INCLUS / PRIX).
          Ordre Will 2026-05-24 v3 : PRICING déplacé APRÈS la section WHY (Six raisons)
          → la grille tarifaire arrive après que le client a compris pourquoi nous choisir. */}
      <section
        id="pricing"
        aria-labelledby="pricing-heading"
        className="bg-paper py-24 sm:py-28 lg:py-32"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {isFr ? "Tarifs transparents" : "Transparent pricing"}
              </p>
              <h2
                id="pricing-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
                {isFr ? "Un prix de départ " : "A starting price "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "pour chaque service." : "for every service."}
                </span>
              </h2>
              <p className="text-fg-soft mx-auto mt-5 max-w-2xl text-lg leading-relaxed">
                {isFr
                  ? "Chaque projet est unique — la complexité dépend de votre infrastructure, de vos process et de votre maturité IA. Voici les prix de départ par service. Le devis précis se construit ensemble, après diagnostic."
                  : "Every project is unique — complexity depends on your infrastructure, your processes and your AI maturity. Below are the starting prices per service. The precise quote is built together, after diagnosis."}
              </p>
            </div>
          </FadeInOnView>

          {/* ─── TABLEAU SINGLE-BLOCK — desktop ≥ md, cards stacked mobile ─── */}
          {/* A11Y Phase 1 fix 2026-05-25 — LHCI gate axe-core `aria-allowed-role`
              + `aria-required-children` échouaient sur l'ancien pattern
              `<div role="table"><Link role="row">…</Link></div>` :
                1) <Link> rend un <a role="link"> → forcer role="row" est interdit
                   pour les éléments interactifs (axe-core aria-allowed-role)
                2) <div role="table"> sans <div role="rowgroup"> intermédiaire
                   manque les enfants requis (aria-required-children)
              Refactor : suppression de toute la sémantique ARIA table — la
              grille reste visuelle (CSS Grid Tailwind). L'AT voit une liste de
              5 liens services, ce qui est la sémantique réelle (chaque ligne
              est un lien cliquable, pas une cellule de données). */}
          <FadeInOnView>
            <div className="mx-auto max-w-6xl">
              <ul
                role="list"
                aria-label={
                  isFr ? "Grille tarifaire des cinq services" : "Pricing grid of five services"
                }
                className="bg-paper border-border shadow-elevated overflow-hidden rounded-3xl border"
              >
                {/* En-tête colonnes (desktop seulement) — hors du flux de liste
                    pour ne pas casser la sémantique <ul><li> stricte. Présenté
                    comme un row visuel uniquement, masqué aux AT via aria-hidden. */}
                <li
                  aria-hidden="true"
                  className="bg-sand text-fg-muted border-border hidden border-b px-8 py-4 text-[11px] font-bold tracking-[0.18em] uppercase md:grid md:grid-cols-[2.2fr_1fr_2.4fr_1.3fr] md:items-center md:gap-6"
                >
                  <span>{isFr ? "Service" : "Service"}</span>
                  <span>{isFr ? "Catégorie" : "Category"}</span>
                  <span>{isFr ? "Inclus" : "Included"}</span>
                  <span className="text-right">{isFr ? "Prix HT" : "Price excl. tax"}</span>
                </li>

                {/* 5 lignes services */}
                {(
                  [
                    {
                      id: "formation",
                      dotColor: "bg-terracotta",
                      badgeBg: "bg-terracotta-soft",
                      badgeFg: "text-terracotta-deep",
                      svc: SERVICE_BY_ID.formations,
                      subFr: "Présentiel · À partir d'une demi-journée",
                      subEn: "On-site · From a half-day",
                      categoryFr: "Formation",
                      categoryEn: "Training",
                      includesFr: "Ateliers métier · Sur site · Groupes 1–30 pers.",
                      includesEn: "Business workshops · On-site · Groups of 1–30",
                      price: interventionEntryPrice,
                      href: "/formations" as const,
                    },
                    {
                      id: "coaching",
                      dotColor: "bg-ochre",
                      badgeBg: "bg-ochre-soft",
                      badgeFg: "text-ochre-deep",
                      svc: SERVICE_BY_ID.unAUn,
                      subFr: "Par session · Dirigeant ou collaborateur",
                      subEn: "Per session · Executive or staff",
                      categoryFr: "Coaching",
                      categoryEn: "Coaching",
                      includesFr: "Sessions individuelles · Automatisations live · ROI J+1",
                      includesEn: "Individual sessions · Live automations · ROI day-one",
                      price: unAUnEntryPrice,
                      href: "/un-a-un" as const,
                    },
                    {
                      id: "audit",
                      dotColor: "bg-primary",
                      badgeBg: "bg-primary-soft",
                      badgeFg: "text-primary",
                      svc: SERVICE_BY_ID.audit,
                      subFr: "Présentiel ou distanciel",
                      subEn: "On-site or remote",
                      categoryFr: "Audit",
                      categoryEn: "Audit",
                      includesFr: "Diagnostic process · Gains chiffrés · Roadmap 6–12 mois",
                      includesEn: "Process diagnosis · Quantified gains · 6–12 month roadmap",
                      price: auditEntryPrice,
                      href: "/audit" as const,
                    },
                    {
                      id: "implementation",
                      dotColor: "bg-sage",
                      badgeBg: "bg-sage-soft",
                      badgeFg: "text-sage",
                      svc: SERVICE_BY_ID.implementation,
                      subFr: "Sur mesure · Projets clés en main",
                      subEn: "Custom · Turnkey projects",
                      categoryFr: "Implémentation",
                      categoryEn: "Implementation",
                      includesFr: "Automatisations · Intégration CRM/ERP · Support 90j",
                      includesEn: "Automations · CRM/ERP integration · 90-day support",
                      price: implEntryPrice,
                      href: "/implementation" as const,
                    },
                    {
                      id: "web",
                      dotColor: "bg-plum",
                      badgeBg: "bg-plum-soft",
                      badgeFg: "text-plum-deep",
                      svc: SERVICE_BY_ID.sitesWeb,
                      subFr: "Sur devis · Plateformes IA dédiées",
                      subEn: "Quote · Dedicated AI platforms",
                      categoryFr: "Plateforme",
                      categoryEn: "Platform",
                      includesFr: "Web IA sur mesure · Reco & search natifs · RGPD Europe",
                      includesEn: "Custom AI web · Native reco & search · EU GDPR",
                      price: webEntryPrice,
                      href: "/sites-web-augmentes" as const,
                    },
                  ] as const
                ).map((s, idx) => (
                  <li key={s.id}>
                    <Link
                      href={s.href}
                      className={cn(
                        "group hover:bg-sand/50 focus-visible:bg-sand/70 relative grid items-center gap-4 px-6 py-6 transition-colors focus-visible:outline-none md:grid-cols-[2.2fr_1fr_2.4fr_1.3fr] md:gap-6 md:px-8 md:py-7",
                        idx > 0 && "border-border border-t",
                      )}
                    >
                      {/* Colonne 1 — Service (dot + nom + sub) */}
                      <div className="flex items-start gap-3 md:items-center">
                        <span
                          className={cn(
                            "mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full md:mt-0",
                            s.dotColor,
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-fg text-base leading-tight font-bold sm:text-lg">
                            {serviceNavShort(s.svc, isFr)}
                          </p>
                          <p className="text-fg-muted mt-1 text-xs leading-snug sm:text-sm">
                            {isFr ? s.subFr : s.subEn}
                          </p>
                        </div>
                      </div>

                      {/* Colonne 2 — Catégorie (badge pill) */}
                      <div className="md:flex md:items-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                            s.badgeBg,
                            s.badgeFg,
                          )}
                        >
                          {isFr ? s.categoryFr : s.categoryEn}
                        </span>
                      </div>

                      {/* Colonne 3 — Inclus */}
                      <div className="text-fg-soft text-sm leading-relaxed">
                        {isFr ? s.includesFr : s.includesEn}
                      </div>

                      {/* Colonne 4 — Prix HT + flèche */}
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <div className="text-right">
                          <p
                            className="text-fg text-xl font-bold tracking-tight sm:text-2xl"
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            {s.price}
                          </p>
                          <p className="text-fg-muted text-[11px] leading-snug">
                            {isFr ? "à partir de" : "starting at"}
                          </p>
                        </div>
                        <span
                          aria-hidden="true"
                          className="bg-paper border-border text-fg-soft group-hover:border-terracotta group-hover:bg-terracotta group-hover:text-paper inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
                        >
                          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </FadeInOnView>
          <p className="text-fg-muted mt-10 text-center text-sm leading-relaxed">
            {isFr ? (
              <>
                Pas sûr du bon service pour vous ?{" "}
                <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                  Parlons-en
                </Link>{" "}
                — on prend le temps d&apos;écouter, d&apos;analyser votre contexte et de vous
                proposer la solution la plus adaptée. Sans engagement.
              </>
            ) : (
              <>
                Not sure which service fits?{" "}
                <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                  Let&apos;s discuss
                </Link>{" "}
                — we take the time to listen, analyse your context and propose the best-fit
                solution. No commitment.
              </>
            )}
          </p>
          {/* Lien contextuel /methodologie (audit P0-4 internal linking 2026-05-24) */}
          <p className="text-fg-muted mt-4 text-center text-sm leading-relaxed">
            <Link
              href="/methodologie"
              className="text-terracotta inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {isFr ? "Voir notre méthode en 4 étapes" : "See our 4-step method"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
          {/* Lien contextuel /tarifs (audit sitelinks 2026-07-06) — la page Tarifs
              n'était liée que via header/footer ; ce lien in-content renforce sa
              candidature de sitelink Google. */}
          <p className="text-fg-muted mt-4 text-center text-sm leading-relaxed">
            <Link
              href="/tarifs"
              className="text-terracotta inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {isFr ? "Voir la grille tarifaire complète" : "See the full pricing grid"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
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
                <h2
                  id="videos-heading"
                  className="text-mocha-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                >
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
      <section
        id="cases"
        aria-labelledby="cases-heading"
        className="bg-paper py-24 sm:py-28 lg:py-36"
      >
        <Container>
          <FadeInOnView>
            <div className="mb-16 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                  {t("casesEyebrow")}
                </p>
                <h2
                  id="cases-heading"
                  className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                >
                  {isFr ? "Des implémentations" : "Custom"}{" "}
                  <span
                    className="italic-editorial text-terracotta"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? "sur mesure" : "implementations"}
                  </span>
                </h2>
                <p className="text-fg-soft mt-4 text-lg leading-relaxed sm:text-xl">
                  {isFr
                    ? "Pensées pour vos besoins réels d'entreprise — pas des templates génériques."
                    : "Built around your real business needs — not generic templates."}
                </p>
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
        </Container>
        {/* Bande « cas concrets » — même style que la section Réalisations de
            /audit : cartes compactes à largeur fixe (300/340px), images réduites
            en aspect-[16/10], défilement marquee CSS pur (anim `caseScrollX` de
            globals.css, track dupliqué → translateX -50% pour boucler sans saut,
            pause au survol, désactivé en prefers-reduced-motion). Server-only,
            zéro JS. (Will 2026-06-10 : « images trop grosses → comme la section
            Réalisations de /audit ».) */}
        <div className="group relative mt-12 overflow-hidden">
          {/* Fondus latéraux pour une entrée/sortie propre */}
          <div
            aria-hidden="true"
            className="from-paper pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r to-transparent sm:w-24"
          />
          <div
            aria-hidden="true"
            className="from-paper pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l to-transparent sm:w-24"
          />
          {(() => {
            const demos = [
              {
                src: "/images/axion-ia-pipeline-lead-ia-zero-intervention-humaine-7-etapes-banniere.avif",
                industryFr: "Prospection B2B",
                industryEn: "B2B prospecting",
                metric: "0 min/lead",
                titleFr: "Pipeline lead automatisé · 7 étapes",
                titleEn: "Automated lead pipeline · 7 steps",
                excerptFr:
                  "Du formulaire entrant au commercial : scoring IA, enrichissement, segmentation chaud/tiède/froid, routage CRM. Zéro intervention humaine jusqu'à la prise de contact.",
                excerptEn:
                  "From incoming form to sales: AI scoring, enrichment, hot/warm/cold segmentation, CRM routing. Zero human intervention until first contact.",
                altFr:
                  "Pipeline Axion-IA : 7 étapes automatisées du formulaire entrant au CRM (scoring IA, enrichissement, segmentation chaud/tiède/froid, routage).",
                altEn:
                  "Axion-IA pipeline: 7 automated steps from incoming form to CRM (AI scoring, enrichment, hot/warm/cold segmentation, routing).",
              },
              {
                src: "/images/axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere.avif",
                industryFr: "BTP & construction",
                industryEn: "Construction",
                metric: "Conflits détectés J-7",
                titleFr: "Planning Gantt IA · temps réel",
                titleEn: "AI Gantt planning · real-time",
                excerptFr:
                  "Chantier Résidence Les Pins, 15 tâches. Conflits de ressources et alertes météo détectés automatiquement avant qu'ils arrivent.",
                excerptEn:
                  "Résidence Les Pins worksite, 15 tasks. Resource conflicts and weather alerts detected automatically before they happen.",
                altFr:
                  "Planning Gantt Axion-IA : chantier Résidence Les Pins, 15 tâches, conflits de ressources détectés automatiquement, alertes météo.",
                altEn:
                  "Axion-IA Gantt planning: Résidence Les Pins worksite, 15 tasks, automatically detected resource conflicts, weather alerts.",
              },
              {
                src: "/images/axion-ia-recrutement-ia-8-semaines-a-3-semaines-80-pourcent-automatise-banniere.avif",
                industryFr: "Ressources humaines",
                industryEn: "Human resources",
                metric: "8 sem → 3 sem · 80% auto",
                titleFr: "Recrutement IA · cycle divisé par 2,5",
                titleEn: "AI recruitment · cycle divided by 2.5",
                excerptFr:
                  "Publication multi-plateformes, collecte CVs, scoring et classement, fiche candidat auto, convocations, CR entretien, contrat rédigé. RH ne valide que la shortlist et conduit les entretiens.",
                excerptEn:
                  "Multi-platform posting, CV collection, scoring and ranking, auto candidate sheet, invites, interview report, contract draft. HR only validates the shortlist and conducts interviews.",
                altFr:
                  "Schéma 3 couloirs Axion-IA : système IA (publication, collecte CV, scoring, fiche, convocation, CR, contrat), RH (validation shortlist, entretiens, signature), candidat. 8 semaines → 3 semaines, 80% des tâches automatisées.",
                altEn:
                  "Axion-IA 3-lane diagram: AI system (posting, CV collection, scoring, sheet, invitation, report, contract), HR (shortlist validation, interviews, signature), candidate. 8 weeks → 3 weeks, 80% of tasks automated.",
              },
              {
                src: "/images/axion-ia-architecture-groupe-international-consolidation-financiere-rh-banniere.avif",
                industryFr: "Groupe international",
                industryEn: "International group",
                metric: "3 sem → J+1 · 278 salariés",
                titleFr: "Consolidation groupe 4 pays · IA continue",
                titleEn: "4-country group consolidation · continuous AI",
                excerptFr:
                  "France, Allemagne, Singapour, Brésil. Comptabilité, paie, supply chain, RH et compliance temps réel. Le cerveau IA agrège les 4 moteurs, détecte les anomalies cross-entités et génère le rapport consolidé J+1.",
                excerptEn:
                  "France, Germany, Singapore, Brazil. Real-time accounting, payroll, supply chain, HR and compliance. AI brain aggregates the 4 engines, detects cross-entity anomalies and generates the consolidated report on D+1.",
                altFr:
                  "Architecture groupe international Axion-IA : 4 entités (France siège, Allemagne production, Singapour Asie hub, Brésil commercial), tableau de bord groupe temps réel, cerveau IA central, consolidation financière 4 devises, compliance multi-juridictions, supply chain intelligente, RH groupe centralisé.",
                altEn:
                  "Axion-IA international group architecture: 4 entities (France HQ, Germany production, Singapore Asia hub, Brazil commercial), real-time group dashboard, central AI brain, 4-currency financial consolidation, multi-jurisdiction compliance, intelligent supply chain, centralized group HR.",
              },
            ] as const;
            // Dupliqué pour une boucle continue (translateX -50% → défile droite→gauche).
            const tracks = [...demos, ...demos];
            return (
              <ul
                className="case-marquee-track flex w-max list-none items-stretch gap-5 p-0 motion-reduce:animate-none sm:gap-6"
                style={
                  {
                    "--marquee-duration": "80s",
                    animation: "caseScrollX var(--marquee-duration) linear infinite",
                  } as CSSProperties
                }
              >
                {tracks.map((demo, idx) => (
                  <li key={idx} aria-hidden={idx >= demos.length}>
                    <article className="border-border bg-bg shadow-subtle hover:border-terracotta/50 hover:shadow-card flex w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border transition sm:w-[340px]">
                      {/* Visuel — image réduite, aspect 16/10, object-cover */}
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <Image
                          src={demo.src}
                          alt={isFr ? demo.altFr : demo.altEn}
                          fill
                          loading="lazy"
                          decoding="async"
                          sizes="340px"
                          className="object-cover"
                        />
                        <span className="bg-paper/90 text-terracotta-deep absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase backdrop-blur">
                          {isFr ? demo.industryFr : demo.industryEn}
                        </span>
                      </div>

                      {/* Contenu */}
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="text-fg text-[17px] leading-snug font-semibold tracking-tight">
                          {isFr ? demo.titleFr : demo.titleEn}
                        </h3>
                        <p
                          className="text-terracotta mt-3 text-2xl leading-none font-semibold tracking-tight"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {demo.metric}
                        </p>
                        <p className="text-fg-soft mt-3 line-clamp-4 text-[13.5px] leading-relaxed">
                          {isFr ? demo.excerptFr : demo.excerptEn}
                        </p>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
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
                    ? "Décrivez votre projet en 2 minutes. On vous répond sous 48h — sans engagement."
                    : "Describe your project in 2 minutes. We reply within 48h — no commitment."}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <Link
                  href="/appel"
                  className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="text-paper border-paper/40 hover:bg-paper/10 cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Link>
              </div>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* ───────────── AUDIENCE + SECTEURS (Blueprint §11) ─────────────
          4 segments TPE/PME/ETI/Grande + nuage des secteurs. Texte
          riche en keywords pour AEO ("IA pour PME françaises", "cabinet
          IA grandes entreprises"…). */}
      <section
        id="audience"
        aria-labelledby="audience-heading"
        className="bg-bg py-24 sm:py-28 lg:py-32"
      >
        <Container>
          <FadeInOnView>
            <div className="mb-16 max-w-3xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {t("audienceEyebrow")}
              </p>
              <h2
                id="audience-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
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
              <li
                key={seg.id}
                className="bg-paper border-border hover:border-border-strong flex h-full flex-col gap-4 rounded-2xl border p-7 transition"
              >
                <FadeInOnView delay={idx * 70}>
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
                </FadeInOnView>
              </li>
            ))}
          </ul>
          {/* Nuage de secteurs (Blueprint §11 — éviter section séparée).
              Signal AEO fort : entités sectorielles indexées par LLM. */}
          <FadeInOnView>
            <div className="border-border-strong mt-16 border-t pt-12">
              {/* Promu h3 → h2 (audit A4 2026-05-24 : section autonome, pas
                  un sous-titre de la sub-section audience précédente) */}
              <h2 className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
                {t("audienceSectorsTitle")}
              </h2>
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
        serviceLabelFr="Axion-IA"
        serviceLabelEn="Axion-IA"
        serviceSlug="audit"
        tone="sand"
      />

      {/* ─────────────── TESTIMONIALS — design premium étoiles + avatars ───────────────
          Cards avec rating 5 étoiles terracotta, avatar initiales, quote serif,
          identité auteur + entreprise. 6 témoignages en grid 3 col desktop. */}
      <section
        id="testimonials"
        aria-labelledby="testimonials-heading"
        className="bg-paper py-24 sm:py-28 lg:py-36"
      >
        <Container>
          <FadeInOnView>
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                {t("testimonialsEyebrow")}
              </p>
              <h2
                id="testimonials-heading"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
              >
                {t("testimonialsTitlePart1")}{" "}
                <span
                  className="italic-editorial text-terracotta"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {t("testimonialsTitleEm")}
                </span>
                {t("testimonialsTitlePart2")}
              </h2>
              {/* Note moyenne RÉELLE, dérivée des avis publiés (customer_reviews). */}
              {homeReviewsAgg ? (
                <div className="mt-7 inline-flex flex-col items-center gap-2">
                  <div
                    role="img"
                    aria-label={`${homeReviewsAgg.ratingValue.toLocaleString("fr-FR", { minimumFractionDigits: 1 })} sur 5`}
                    className="flex items-center gap-1"
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${i < Math.round(homeReviewsAgg.ratingValue) ? "text-terracotta fill-current" : "text-border"}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <p className="text-fg-soft text-sm">
                    <span className="text-fg font-bold">
                      {homeReviewsAgg.ratingValue.toLocaleString("fr-FR", {
                        minimumFractionDigits: 1,
                      })}{" "}
                      / 5
                    </span>
                    {isFr
                      ? ` — sur ${homeReviewsAgg.reviewCount} avis clients vérifiés`
                      : ` — based on ${homeReviewsAgg.reviewCount} verified reviews`}
                  </p>
                </div>
              ) : null}
            </div>
          </FadeInOnView>
          {homeReviews.items.length > 0 ? (
            <HomeReviewsCarousel>
              {homeReviews.items.map((r) => (
                <ReviewCard key={r.id} review={r} className="h-full" />
              ))}
            </HomeReviewsCarousel>
          ) : (
            <div className="border-border mx-auto max-w-xl rounded-2xl border border-dashed p-8 text-center">
              <p className="text-fg-soft">
                {isFr
                  ? "Nos premiers avis clients arrivent. "
                  : "Our first customer reviews are coming. "}
                <Link href="/avis/deposer" className="text-terracotta font-semibold underline">
                  {isFr ? "Soyez le premier à témoigner" : "Be the first to leave a review"}
                </Link>
              </p>
            </div>
          )}
          {/* Lien vers le hub des avis clients */}
          <p className="text-fg-muted mt-12 text-center text-sm">
            <Link
              href="/avis"
              className="text-terracotta inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              {isFr ? "Voir tous les avis clients" : "See all customer reviews"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </p>
        </Container>
      </section>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ FAQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <section id="faq" aria-labelledby="faq-heading" className="bg-bg py-24 sm:py-28 lg:py-36">
        <Container className="max-w-3xl">
          <FadeInOnView>
            <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
              FAQ
            </p>
            <h2
              id="faq-heading"
              className="text-fg text-[clamp(2rem,4vw,3rem)] leading-[1.1] font-semibold tracking-tight"
            >
              {t("faqTitle")}
            </h2>
            <p className="text-fg-soft mt-4 text-base leading-relaxed">{t("faqDescription")}</p>
            <div className="mt-12">
              {/* CSS-only + permalien par question vers sa page dédiée indexable
                  (maillage interne — perfection FAQ 2026-05-31). emitJsonLd=false :
                  la home émet déjà son FAQPage via buildFaqSpeakableJsonLd. */}
              <FaqAccordion
                items={faqs}
                emitJsonLd={false}
                permalinkBase={`/${loc}/faq`}
                permalinkLabel={isFr ? "Lire la réponse complète" : "Read full answer"}
              />
              <p className="text-fg-muted mt-8 text-center text-sm">
                {isFr ? (
                  <>
                    Vous avez d&apos;autres questions ?{" "}
                    <Link href="/faq" className="text-terracotta font-semibold hover:underline">
                      Voir toute la FAQ
                    </Link>{" "}
                    (30+ questions) ou{" "}
                    <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                      nous contacter
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    More questions?{" "}
                    <Link href="/faq" className="text-terracotta font-semibold hover:underline">
                      See the full FAQ
                    </Link>{" "}
                    (30+ questions) or{" "}
                    <Link href="/contact" className="text-terracotta font-semibold hover:underline">
                      contact us
                    </Link>
                    .
                  </>
                )}
              </p>
              {/* Lien contextuel /transparence (audit P0-4 internal linking 2026-05-24) */}
              <p className="text-fg-muted mt-3 text-center text-xs">
                {isFr ? (
                  <>
                    Voir aussi{" "}
                    <Link
                      href="/transparence"
                      className="text-fg-soft hover:text-terracotta underline-offset-4 hover:underline"
                    >
                      notre politique de transparence
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    See also{" "}
                    <Link
                      href="/transparence"
                      className="text-fg-soft hover:text-terracotta underline-offset-4 hover:underline"
                    >
                      our transparency policy
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </FadeInOnView>
        </Container>
      </section>

      {/* Section CTA FINAL "Choisissez votre point de départ" RETIRÉE (Will 2026-05-24) :
          - faisait doublon avec la grille tarifaire (5 services single-block)
          - "4 heures / 1 journée / 2 jours / 3 jours+ / 2-4 semaines" redondant
          - La FAQ + le StickyMobileCta + le CTA hero suffisent comme points de contact */}

      <JsonLd data={faqJsonLd} />
      <JsonLd data={localBusinessJsonLd} />
      <JsonLd data={servicesJsonLd} />
      {homeImagesJsonLd ? <JsonLd data={homeImagesJsonLd} /> : null}
      {/* BreadcrumbList JSON-LD ABSENT : home = racine hiérarchique (cf. audit A4 2026-05-24) */}
      {videosJsonLd.length > 0 ? <JsonLd data={videosJsonLd} /> : null}
      {homeReviewsOrgAgg ? <JsonLd data={homeReviewsOrgAgg} /> : null}

      {/* ───────────── STICKY MOBILE CTA (Blueprint §19) ─────────────
          Bouton fixé bas d'écran sur mobile, apparaît après scroll > 600 px.
          Disparaît à 320 px du bottom (laisse place au CTA final natif).
          rAF dedup pour INP < 100 ms (cf. perf budget). */}
      <StickyMobileCta
        href="/appel"
        label={isFr ? "Échanger 30 min — sans engagement" : "Talk 30 min — no commitment"}
        track="home-sticky-mobile"
        threshold={600}
      />
    </>
  );
}
