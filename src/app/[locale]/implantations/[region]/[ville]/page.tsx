/**
 * Page hub ville — assemblage composants ville Phase 4 + grille 5 verticales (Sprint A · Phase 6).
 *
 * Route : `/[locale]/implantations/[region]/[ville]`.
 *
 * Le hub n'utilise PAS les composants `services/*` (ils vivent sur les pages
 * verticales `/[verticale]`). Il assemble : hero ville + composants ville
 * Phase 4 (`@/components/ville/*`) + grille 5 verticales (cards → pages
 * ville × verticale) + JSON-LD ville (Place + Service areaServed + Breadcrumb
 * + ItemList 5 verticales + FAQPage Speakable).
 *
 * Anti-doorway HCU 2024 : villes sans `ville.copy` → stub `noindex` + absence
 * du sitemap (`buildImplantationsSitemap` filtre sur `getIndexableVilles`).
 * Wording mentionne explicitement TPE / PME / ETI / grandes entreprises.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Building2,
  Briefcase,
  UserCog,
  Wrench,
  Globe,
} from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Illustration } from "@/components/visual/Illustration";
import { ClientLogosBand } from "@/components/sections/ClientLogosBand";
import { FounderTrustSection } from "@/components/sections/FounderTrustSection";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { fmtPopulation } from "@/lib/intl";

import { getRegion } from "@/content/regions";
import { VILLES, type Ville } from "@/content/villes";
import { resolveVilleWithCopy } from "@/content/villes/resolve-with-copy";
import {
  AUDIT_TIERS,
  INTERVENTION_TIERS,
  UN_A_UN_TIERS,
  IMPLEMENTATION_TIERS,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildPlaceJsonLd,
  buildFaqSpeakableJsonLd,
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  SITE_URL,
} from "@/lib/seo";

import type { City } from "@/lib/cities";
import type { VilleContext, VerticaleSlug } from "@/components/services/types";

// ─── Composants ville Phase 4 ────────────────────────────────────────────────
import { VilleEcosystemeLocal } from "@/components/ville/VilleEcosystemeLocal";
import { VilleTissuEconomique } from "@/components/ville/VilleTissuEconomique";
import { VilleCommunesProches } from "@/components/ville/VilleCommunesProches";
import { VilleFaqGeolocalisee } from "@/components/ville/VilleFaqGeolocalisee";
import { OrangeContactBanner } from "@/components/ville/OrangeContactBanner";
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ locale: string; region: string; ville: string }>;
}

export function generateStaticParams(): Array<{ region: string; ville: string }> {
  return VILLES.map((v) => ({ region: v.region, ville: v.slug }));
}

// P1-13 (audit re-run 2026-05-15) — ISR sur pages villes pSEO (~2150 routes).
export const revalidate = 86400;
export const dynamicParams = true;

/**
 * Adapter `Ville` (composite SSOT TS `@/content/villes`) → `City` consommé
 * par `VilleEcosystemeLocal` (qui type sur le modèle Prisma `@/lib/cities`).
 * Pas de DB call — pure transformation mémoire.
 */
function adaptVilleToCity(v: Ville, regionLabel: string): City {
  return {
    id: v.slug,
    slug: v.slug,
    name: v.nameFr,
    population: v.population,
    departmentCode: v.departement,
    departmentName: v.departementLabel ?? v.departement,
    regionSlug: v.region,
    regionName: regionLabel,
    inseeCode: v.inseeCode,
    latitude: v.geo.lat,
    longitude: v.geo.lon,
    populationTier:
      v.population >= 100_000 ? 1 : v.population >= 20_000 ? 2 : v.population >= 10_000 ? 3 : 4,
    priority: 0,
    isTargeted: true,
    isCovered: !!v.copy,
    articlesCount: 0,
    lastArticleAt: null,
    hasEconomicData: !!v.economicData,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const ville = await resolveVilleWithCopy(villeSlug);
  if (!ville || ville.region !== regionSlug) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const isFr = locale === "fr";
  const isPilot = !!ville.copy;

  const title = isPilot
    ? isFr
      ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Cabinet IA opérationnel`
      : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Operational AI consultancy`
    : isFr
      ? `${ville.nameFr} · Intervention IA opérationnelle (${region.nameFr})`
      : `${ville.nameFr} · Operational AI engagement (${region.nameFr})`;

  // Description ≤ 155 chars (cible Google SERP — au-delà → tronqué).
  const truncateForSerp = (s: string, max = 155): string => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  };
  const rawDescription = isPilot
    ? isFr
      ? (ville.copy?.directAnswerFr ?? ville.copy?.pitchFr ?? "")
      : (ville.copy?.directAnswerEn ?? ville.copy?.pitchEn ?? "")
    : isFr
      ? `Axion-IA intervient à ${ville.nameFr} (${region.nameFr}). 5 modules : audit IA, intervention sur site, implémentation, accompagnement 1-to-1, sites web augmentés. Réservation en ligne.`
      : `Axion-IA operates in ${ville.nameFr} (${region.nameFr}). 5 modules: AI audit, on-site, implementation, 1-to-1, AI-augmented websites. Direct online booking.`;
  const description = truncateForSerp(rawDescription, 155);

  const meta = buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}/${ville.slug}`,
    title,
    description,
    alternates: {
      fr: `/implantations/${region.slug}/${ville.slug}`,
      en: `/locations/${region.slug}/${ville.slug}`,
    },
  });
  // Anti-doorway HCU 2024 — pages sans copy éditorial sortent en `noindex`.
  if (!isPilot) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

// 5 verticales — meta utilisé par la grille du hub.
interface VerticaleMeta {
  readonly slug: VerticaleSlug;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly descFr: string;
  readonly descEn: string;
}

function buildVerticales(v: string): ReadonlyArray<VerticaleMeta> {
  return [
    {
      slug: "audits",
      labelFr: "Audit IA",
      labelEn: "AI Audit",
      descFr: `Diagnostic IA de vos processus à ${v} — 3 chantiers prioritaires chiffrés, roadmap 6 mois, résultat le jour même (Flash) ou en 2-4 semaines (Stratégique). TPE, PME, ETI, grandes entreprises.`,
      descEn: `AI audit in ${v} — 3 costed projects, 6-month roadmap, same-day result (Flash) or 2-4 weeks (Strategic). Micro-businesses, SMBs, mid-market, large enterprises.`,
    },
    {
      slug: "interventions",
      labelFr: "Interventions sur site",
      labelEn: "On-site interventions",
      descFr: `Ateliers et formations IA sur site à ${v} — demi-journée à 2 jours, sur vos données réelles, avec vos équipes. TPE, PME, ETI et grandes entreprises.`,
      descEn: `On-site AI workshops in ${v} — half-day to 2 days, on your real data, with your teams. Micro-businesses, SMBs, mid-market, large enterprises.`,
    },
    {
      slug: "implementations",
      labelFr: "Implémentation IA",
      labelEn: "AI Implementation",
      descFr: `Agents IA, automatisations back-office, CRM/ERP augmentés — livrés en production à ${v}. ROI chiffré avant mission. Toutes tailles d'entreprise.`,
      descEn: `AI agents, back-office automations, augmented CRM/ERP — delivered to production in ${v}. Costed ROI before engagement. All company sizes.`,
    },
    {
      slug: "un-a-un",
      labelFr: "Accompagnement 1-to-1",
      labelEn: "1-to-1 coaching",
      descFr: `Journée 1-to-1 avec William J. à ${v} — cartographie IA de vos processus et 3 chantiers chiffrés, sans engagement. Dirigeants TPE, PME, ETI.`,
      descEn: `1-on-1 day with William J. in ${v} — AI mapping of your processes and 3 costed projects, no commitment. Leaders of SMBs and mid-market.`,
    },
    {
      slug: "sites-web-ia",
      labelFr: "Sites web augmentés IA",
      labelEn: "AI-augmented websites",
      descFr: `Sites web, applications métier et plateformes SaaS augmentées par l'IA — conçus pour vos clients à ${v} et en France. RGPD, hébergement UE.`,
      descEn: `Websites, business apps and AI-augmented SaaS platforms — for your clients in ${v} and across France. GDPR, EU hosting.`,
    },
  ];
}

export default async function VilleHubPage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const ville = await resolveVilleWithCopy(villeSlug);
  if (!ville || ville.region !== regionSlug) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    { href: "/implantations", label: isFr ? "Implantations" : "Locations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
    { href: `/implantations/${region.slug}/${ville.slug}`, label: ville.nameFr },
  ];

  // ─── Pages sans copy : stub minimal noindex (anti-doorway HCU 2024) ───────
  if (!ville.copy) {
    return (
      <VilleStub
        ville={ville}
        regionNameFr={region.nameFr}
        regionSlug={region.slug}
        breadcrumbItems={breadcrumbItems}
        isFr={isFr}
      />
    );
  }

  const copy = ville.copy;
  const villeContext: VilleContext = {
    name: ville.nameFr,
    region: region.nameFr,
    regionSlug: region.slug,
    villeSlug: ville.slug,
    inseeCode: ville.inseeCode,
    population: ville.population,
  };
  const villeAsCity = adaptVilleToCity(ville, region.nameFr);

  // FAQ ville-spécifiques curatées (4-6 Q minimum pour activer Speakable JSON-LD).
  const villeSpecificFaqs: ReadonlyArray<{ q: string; a: string }> = (
    copy.faqGeolocalisee ?? []
  ).slice(0, 10);

  const verticales = buildVerticales(ville.nameFr);

  // ─── JSON-LD globaux page (Place + Service areaServed + Breadcrumb + ItemList + FAQ Speakable) ───
  const path = `/implantations/${region.slug}/${ville.slug}` as `/${string}`;
  const url = `${SITE_URL}/${loc}${path}`;

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: isFr
      ? `Cabinet IA opérationnel à ${ville.nameFr} · Axion-IA`
      : `Operational AI consultancy in ${ville.nameFr} · Axion-IA`,
    description: isFr ? copy.pitchFr : copy.pitchEn,
    serviceType: isFr ? "Cabinet IA opérationnel B2B" : "Operational B2B AI consultancy",
    areasServed: [
      { type: "City", name: ville.nameFr, url },
      {
        type: "AdministrativeArea",
        name: region.nameFr,
        url: `${SITE_URL}/${loc}/implantations/${region.slug}`,
      },
      { type: "Country", name: "France" },
    ],
  });

  const placeJsonLd = buildPlaceJsonLd({
    locale: loc,
    path,
    name: ville.nameFr,
    geo: { latitude: ville.geo.lat, longitude: ville.geo.lon },
    containedInPlace: {
      name: region.nameFr,
      url: `${SITE_URL}/${loc}/implantations/${region.slug}`,
    },
    population: ville.population,
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: path },
    ],
  });

  // ItemList : 5 verticales disponibles à cette ville.
  const verticalesItemList = buildItemListJsonLd({
    locale: loc,
    path,
    name: isFr ? `Nos 5 modules à ${ville.nameFr}` : `Our 5 modules in ${ville.nameFr}`,
    items: verticales.map((v, idx) => ({
      position: idx + 1,
      name: isFr ? v.labelFr : v.labelEn,
      description: isFr ? v.descFr : v.descEn,
      url: `${SITE_URL}/${loc}/implantations/${region.slug}/${ville.slug}/${v.slug}`,
    })),
  });

  // FAQ Speakable étend Speakable au hero (directAnswer voice-search).
  const faqSpeakableJsonLd = villeSpecificFaqs.length
    ? buildFaqSpeakableJsonLd({
        items: villeSpecificFaqs.map((f) => ({ question: f.q, answer: f.a })),
        additionalSelectors: ["[data-speakable-hero]"],
      })
    : null;

  // AggregateOffer JSON-LD — Prix entry-point des 5 verticales (Will 2026-05-26
  // perfection 2026). Signal AI engine SERP rich snippet (Perplexity, Google AI
  // Overviews) + Google Shopping/Local Pack avec prix inline.
  const auditFlashPrice = getTierById(AUDIT_TIERS, "audit-flash").priceFlat!;
  const auditEtiHighPrice = getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!;
  const interventionEntryPrice = getEntryPriceEur(INTERVENTION_TIERS) ?? 690;
  const unAUnEntryPrice = getEntryPriceEur(UN_A_UN_TIERS) ?? 990;
  const implEntryPrice = getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 990;

  const aggregateOfferJsonLd = {
    "@context": "https://schema.org",
    "@type": "AggregateOffer",
    "@id": `${SITE_URL}${path}#offers`,
    name: `Services Axion-IA à ${ville.nameFr}`,
    description: `Tarifs entry-point des 5 services Axion-IA à ${ville.nameFr} — audit IA, formation, implémentation, coaching 1-to-1 dirigeants, plateformes web/SaaS IA.`,
    priceCurrency: "EUR",
    lowPrice: auditFlashPrice,
    highPrice: auditEtiHighPrice,
    offerCount: 5,
    areaServed: { "@type": "City", name: ville.nameFr },
    seller: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Axion-IA" },
    offers: [
      {
        "@type": "Offer",
        name: "Audit IA Flash",
        price: auditFlashPrice,
        priceCurrency: "EUR",
        url: `${SITE_URL}/${loc}/audit`,
        availability: "https://schema.org/InStock",
        category: "AI audit",
      },
      {
        "@type": "Offer",
        name: "Intervention Essentielle (formation IA sur site)",
        price: interventionEntryPrice,
        priceCurrency: "EUR",
        url: `${SITE_URL}/${loc}/interventions`,
        availability: "https://schema.org/InStock",
        category: "AI training",
      },
      {
        "@type": "Offer",
        name: "Coaching 1-to-1 dirigeant",
        price: unAUnEntryPrice,
        priceCurrency: "EUR",
        url: `${SITE_URL}/${loc}/un-a-un`,
        availability: "https://schema.org/InStock",
        category: "AI executive coaching",
      },
      {
        "@type": "Offer",
        name: "Implémentation IA — Pilote",
        price: implEntryPrice,
        priceCurrency: "EUR",
        url: `${SITE_URL}/${loc}/implementation`,
        availability: "https://schema.org/InStock",
        category: "AI implementation",
      },
      {
        "@type": "Offer",
        name: "Plateforme web / SaaS IA sur mesure",
        priceSpecification: {
          "@type": "PriceSpecification",
          priceCurrency: "EUR",
          minPrice: implEntryPrice,
        },
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        availability: "https://schema.org/InStock",
        category: "AI web platform / SaaS",
      },
    ],
  } as const;

  // ImageObject JSON-LD — Hero image triangle 3 piliers Axion-IA (Will 2026-05-26).
  // Signal Google Images + AI engines pour indexation visuelle de la marque.
  // Licence CC BY 4.0 (cohérent avec /galerie banque d'images Axion-IA).
  const heroImageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "@id": `${SITE_URL}${path}#hero-image`,
    contentUrl: `${SITE_URL}/images/axion-ia-ville-hero-triangle-3-piliers-temps-couts-resultats-carre.avif`,
    url: `${SITE_URL}/images/axion-ia-ville-hero-triangle-3-piliers-temps-couts-resultats-carre.avif`,
    name: `Axion-IA · 3 piliers à ${ville.nameFr}`,
    description: `Triangle Axion-IA des 3 piliers à ${ville.nameFr} : gagnez du temps, réduisez vos coûts, maximisez vos résultats — 100 % gagnant, moins de complexité, plus de performance.`,
    width: 1254,
    height: 1254,
    encodingFormat: "image/avif",
    creator: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Axion-IA" },
    copyrightHolder: { "@type": "Organization", name: "Axion-IA OÜ" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    acquireLicensePage: `${SITE_URL}/${loc}/galerie`,
    contentLocation: {
      "@type": "Place",
      name: ville.nameFr,
      containedInPlace: { "@type": "AdministrativeArea", name: region.nameFr },
    },
  } as const;

  return (
    <>
      <Container>
        <div className="pt-6 pb-2">
          <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
        </div>
      </Container>

      {/* ── Hero hub ville (Will 2026-05-26 refonte perfection) ──
          Layout 2-col image + texte. H1 hook concurrentiel localisé à la
          ville (cohérent avec les pages régions). Sous-ligne énumérant les
          5 services Axion-IA + 5 badges visuels pour compréhension immédiate.
          Image universelle globe-services (réutilisée des pages régions). */}
      <section
        aria-labelledby="ville-hub-hero"
        className="bg-halo-warm relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24"
      >
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            {/* Colonne gauche — copy */}
            <div className="max-w-2xl">
              <p className="text-fg-muted mb-5 text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? `Architectes IA · ${ville.nameFr}` : `AI architects · ${ville.nameFr}`}
              </p>
              <h1
                id="ville-hub-hero"
                className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
                data-speakable-hero
              >
                {isFr ? "Vos concurrents à " : "Vos concurrents à "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {ville.nameFr}
                </span>
                {isFr ? " utilisent déjà l'IA. Et vous ?" : " utilisent déjà l'IA. Et vous ?"}
              </h1>
              {/* Sous-ligne hero — copy unifié + locale ville. Réponse au hook. */}
              <p
                className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
                data-speakable-hero
              >
                {isFr ? "Architectes IA seniors à " : "Architectes IA seniors à "}
                <span className="text-fg font-semibold">
                  {ville.nameFr} {isFr ? "et alentours" : "et alentours"}
                </span>
                {isFr
                  ? " — audit IA, formation entreprise, implémentation, coaching 1-to-1 dirigeants, plateformes web et SaaS IA. De la TPE à l'ETI."
                  : " — audit IA, formation entreprise, implémentation, coaching 1-to-1 dirigeants, plateformes web et SaaS IA. De la TPE à l'ETI."}
              </p>
              {/* Badges 5 services — compréhension immédiate des prestations.
                  Petits pills terracotta-soft avec icône Lucide. */}
              <ul
                aria-label={isFr ? "Nos 5 services" : "Our 5 services"}
                className="mt-6 flex flex-wrap gap-2"
              >
                {(
                  [
                    { Icon: Briefcase, labelFr: "Audit IA", labelEn: "AI audit" },
                    { Icon: Building2, labelFr: "Formation", labelEn: "Training" },
                    { Icon: Wrench, labelFr: "Implémentation", labelEn: "Implementation" },
                    { Icon: UserCog, labelFr: "Coaching 1-to-1", labelEn: "1-to-1 coaching" },
                    { Icon: Globe, labelFr: "Web / SaaS IA", labelEn: "AI Web / SaaS" },
                  ] as const
                ).map(({ Icon, labelFr, labelEn }) => (
                  <li
                    key={labelFr}
                    className="bg-terracotta-soft text-terracotta-deep border-terracotta/30 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold tracking-tight"
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {isFr ? labelFr : labelEn}
                  </li>
                ))}
              </ul>
              {/* Stats inline */}
              <div className="text-fg-muted mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
                  {isFr ? "habitants" : "inhabitants"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {ville.departementLabel ?? ville.departement}
                </span>
                {ville.postalCode ? <span className="tabular-nums">{ville.postalCode}</span> : null}
              </div>
              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Cta
                  href="/appel"
                  variant="primary"
                  size="lg"
                  shape="pill"
                  track="ville_cta_book"
                  data-source-ville={ville.slug}
                >
                  {isFr ? "Réserver un appel" : "Book a call"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta
                  href="/contact"
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  track="ville_cta_contact"
                  data-source-ville={ville.slug}
                >
                  {isFr ? "Nous contacter" : "Contact us"}
                </Cta>
              </div>
            </div>
            {/* Colonne droite — illustration triangle « 3 piliers » Axion-IA :
                Gagnez du temps · Réduisez vos coûts · Maximisez vos résultats.
                Image hand-crafted (Will 2026-05-26), AVIF 56 KB / WebP 91 KB
                fallback PNG. Aspect 1:1, priority LCP. Cachée < lg. */}
            <div className="hidden lg:block">
              <Illustration
                slot="VILLE-01-hero"
                src="/images/axion-ia-ville-hero-triangle-3-piliers-temps-couts-resultats-carre.avif"
                aspectRatio="1:1"
                filenameTarget="public/images/axion-ia-ville-hero-triangle-3-piliers-temps-couts-resultats-carre.avif"
                alt={
                  isFr
                    ? `Triangle Axion-IA des 3 piliers à ${ville.nameFr} : gagnez du temps, réduisez vos coûts, maximisez vos résultats — 100 % gagnant, moins de complexité, plus de performance.`
                    : `Triangle Axion-IA des 3 piliers à ${ville.nameFr} : gagnez du temps, réduisez vos coûts, maximisez vos résultats — 100 % gagnant, moins de complexité, plus de performance.`
                }
                caption={
                  isFr
                    ? `Axion-IA · 3 piliers à ${ville.nameFr}`
                    : `Axion-IA · 3 piliers à ${ville.nameFr}`
                }
                priority
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ── Bandeau logos clients — preuve sociale juste après le hero ── */}
      <ClientLogosBand isFr={isFr} />

      {/* ── Écosystème économique local (composant ville Phase 4) ── */}
      <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} />

      {/* ── Tissu économique : secteurs, opportunités IA (composant ville Phase 4) ── */}
      <VilleTissuEconomique ville={ville} isFr={isFr} />

      {/* ── Grille 5 verticales : entrée principale du hub vers les pages ville × verticale ── */}
      <section
        id="ville-verticales"
        aria-labelledby="ville-verticales-heading"
        className="bg-paper border-border border-t py-16 sm:py-20 lg:py-24"
      >
        <Container>
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
              {isFr ? "Nos 5 modules" : "Our 5 modules"}
            </p>
            <h2
              id="ville-verticales-heading"
              className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.04] font-semibold tracking-tight"
            >
              {isFr ? "Nos 5 modules à" : "Our 5 modules in"}{" "}
              <span
                className="italic-editorial text-terracotta"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {ville.nameFr}.
              </span>
            </h2>
            <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Audit, intervention sur site, implémentation, accompagnement 1-to-1, sites web augmentés. Adapté aux TPE, PME, ETI et grandes entreprises."
                : "Audit, on-site engagement, implementation, 1-to-1 coaching, AI-augmented websites. Adapted to micro-businesses, SMBs, mid-market and large enterprises."}
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {verticales.map((v) => (
              <li key={v.slug} className="h-full">
                <Link
                  href={`/implantations/${region.slug}/${ville.slug}/${v.slug}` as never}
                  className="group bg-paper border-border hover:border-terracotta hover:shadow-elevated focus-visible:ring-terracotta relative flex h-full flex-col overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:p-7"
                >
                  <span
                    aria-hidden="true"
                    className="bg-terracotta absolute inset-x-0 top-0 h-1.5 origin-left"
                  />
                  <h3
                    className="text-fg text-[clamp(1.5rem,2vw,2rem)] leading-[1.06] font-semibold tracking-tight"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {isFr ? v.labelFr : v.labelEn}
                  </h3>
                  <p className="text-fg-soft mt-4 text-sm leading-relaxed">
                    {isFr ? v.descFr : v.descEn}
                  </p>
                  <div className="flex-1" />
                  <span className="border-border text-terracotta group-hover:text-terracotta-deep mt-6 inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold">
                    {isFr ? "Découvrir le module" : "Discover the module"}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ── Bandeau orange contact (milieu de page) ── */}
      <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />

      {/* ── Communes proches (composant ville Phase 4) — sans verticale → liens hub ── */}
      <VilleCommunesProches ville={ville} isFr={isFr} />

      {/* ── FAQ ville-spécifique (composant ville Phase 4) ── */}
      <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />

      {/* ── Section fondateur William J. — crédibilité avant contexte local ── */}
      <FounderTrustSection isFr={isFr} />

      {/* ── Contexte local (Will 2026-05-26) — discret, en bas de page ──
          Décision : directAnswer + stats sortis du hero (bruit côté visiteur).
          Maintenus en bas pour AEO/GEO + anti-duplicate-content cross-villes
          (data différenciée par ville). */}
      <section
        aria-labelledby="ville-contexte-heading"
        className="bg-bg border-border border-t py-12 sm:py-16"
      >
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-fg-muted mb-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
              {isFr ? "Contexte local" : "Local context"}
            </p>
            <h2
              id="ville-contexte-heading"
              className="text-fg text-xl leading-tight font-semibold tracking-tight sm:text-2xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {ville.nameFr}
            </h2>
            <p className="text-fg-soft mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:text-base">
              {isFr ? (copy.directAnswerFr ?? copy.pitchFr) : (copy.directAnswerEn ?? copy.pitchEn)}
            </p>
            <div className="text-fg-muted mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {fmtPopulation(ville.population, isFr ? "fr" : "en")}{" "}
                {isFr ? "habitants" : "inhabitants"}
              </span>
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                {region.nameFr}
              </span>
              {ville.postalCode ? (
                <span className="inline-flex items-center gap-2 tabular-nums">
                  {ville.postalCode}
                </span>
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      {/* AI Act art. 50 disclosure */}
      <AiContentDisclaimer locale={loc} />

      {/* JSON-LD globaux page — 5 schemas @graph, afterInteractive (-300 ms TBT).
          Note : VilleFaqGeolocalisee émet déjà son propre FAQPage JSON-LD inline,
          on n'ajoute donc pas faqSpeakableJsonLd au @graph (anti-doublon Google).
          Les composants ville (EcosystemeLocal, TissuEconomique, CommunesProches)
          émettent leurs ItemList propres ; ici on émet uniquement l'ItemList des
          5 verticales (différent scope). */}
      <JsonLdGraph
        schemas={[
          serviceJsonLd,
          placeJsonLd,
          breadcrumbJsonLd,
          verticalesItemList,
          heroImageJsonLd,
          aggregateOfferJsonLd,
          faqSpeakableJsonLd ?? null,
        ]}
        strategy="afterInteractive"
        scriptId={`jsonld-ville-hub-${ville.slug}`}
      />
    </>
  );
}

// ===========================================================================
// Stub minimal pour les ~2 156 villes sans copy éditorial.
// Anti-doorway HCU 2024 : page physique SSG accessible mais `noindex` +
// absente du sitemap (`buildImplantationsSitemap` filtre sur `getIndexableVilles`).
// ===========================================================================
interface VilleStubProps {
  ville: Ville;
  regionNameFr: string;
  regionSlug: string;
  breadcrumbItems: ReadonlyArray<{ href: string; label: string }>;
  isFr: boolean;
}
function VilleStub({ ville, regionNameFr, regionSlug, breadcrumbItems, isFr }: VilleStubProps) {
  return (
    <Section
      titleAs="h1"
      eyebrow={isFr ? `Implantations · ${regionNameFr}` : `Locations · ${regionNameFr}`}
      title={isFr ? "Axion-IA intervient à" : "Axion-IA covers"}
      titleEm={ville.nameFr}
      description={
        isFr
          ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) fait partie des communes éligibles à nos interventions sur site, audits IA et missions d'implémentation. La page locale détaillée est en préparation — réservez dès maintenant via la page régionale.`
          : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) is among the eligible communes for our on-site engagements, AI audits and implementation missions. The detailed local page is in preparation — book now via the regional page.`
      }
    >
      <div className="mb-8">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Cta
          href={`/implantations/${regionSlug}` as never}
          variant="primary"
          size="lg"
          shape="pill"
          track="ville_stub_back_region"
        >
          {isFr ? `Voir la région ${regionNameFr}` : `See the ${regionNameFr} region`}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Cta>
        <Cta
          href="/appel"
          variant="ghost"
          size="lg"
          shape="pill"
          track="ville_stub_book"
          data-source-ville={ville.slug}
        >
          {isFr ? "Réserver un appel" : "Book a call"}
        </Cta>
      </div>
      <AiContentDisclaimer locale={isFr ? "fr" : "en"} className="mt-8" />
    </Section>
  );
}
