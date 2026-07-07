/**
 * Page hub ville — assemblage composants ville Phase 4 + grille 5 modules (Sprint A · Phase 6).
 *
 * Route : `/[locale]/implantations/[region]/[ville]`.
 *
 * Refonte architecture villes 2026-05-26 (Will) : suppression des 10 750 pages
 * ville × verticale (risque doorway HCU 2024 + cannibalisation des pages services
 * principales). Les 5 cards du hub pointent désormais DIRECTEMENT vers les pages
 * services canoniques (`/audit`, `/interventions`, `/implementation`, `/un-a-un`,
 * `/sites-web-augmentes`) — pattern BCG / Roland Berger / Deloitte. Les routes
 * `[verticale]` ont été supprimées, 301 redirects ajoutés dans `next.config.ts`.
 *
 * Anti-doorway HCU 2024 : villes sans `ville.copy` → stub `noindex` + absence
 * du sitemap (`buildImplantationsSitemap` filtre sur `getIndexableVilles`).
 * Wording mentionne explicitement TPE / PME / ETI / grandes entreprises.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin, Building2 } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { ServicesGrid } from "@/components/services/ServicesGrid";
import { SERVICE_VISUAL, ACCENT_CLASSES } from "@/content/services-visual";
import type { ServiceId } from "@/content/services";
import { Cta } from "@/components/marketing/Cta";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { getBlogArticlesByVille } from "@/server/content-gen/blog/get-articles-by-ville";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Illustration } from "@/components/visual/Illustration";
import { hasVilleHeroImage } from "@/content/villes/hero-images-map";
import { ClientLogosBand } from "@/components/sections/ClientLogosBand";
import { FounderTrustSection } from "@/components/sections/FounderTrustSection";
import { PricingGridVille } from "@/components/sections/PricingGridVille";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { fmtPopulation } from "@/lib/intl";

import { getRegion } from "@/content/regions";
import { VILLES, type Ville, isVilleIndexable } from "@/content/villes";
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
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  buildWebPageJsonLd,
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
  // 2026-05-27 — Build T3 batch saturait le disk GH Actions runner (No space left
  // on device). On limite generateStaticParams aux villes pop ≥ 100k (= T1+T2 ~40
  // villes seulement). Toutes les autres villes (T3 + T4) sont rendues en ISR
  // on-demand au 1er hit (`dynamicParams=true` + revalidate=86400 = recache 24h).
  // Trade-off : 1er hit T3 = ~500ms latence, mais build SSG passe de 17 629 à
  // ~13 500 routes (économie ~5 GB disk + 8 min build).
  // Les villes T3 restent indexables (sitemap.xml + meta tags OK), elles sont
  // juste pas pré-rendues au build — Google les crawle = ISR génère = cachée.
  return VILLES.filter((v) => v.population >= 100_000).map((v) => ({
    region: v.region,
    ville: v.slug,
  }));
}

// P1-13 (audit re-run 2026-05-15) — ISR sur pages villes pSEO (~2150 routes).
// dynamicParams=true : génère à la volée toute ville pas dans generateStaticParams.
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
  // P0 2026-06-14 — Fix soft-404 : un slug ville/région introuvable renvoyait des
  // métadonnées vides `{}` → robots par défaut `index,follow` (la page not-found
  // était indexable). On force `noindex,nofollow` pour ne pas indexer de villes
  // fantômes (liens cassés / fuzzing), cohérent avec le notFound() de la page.
  const NOT_FOUND_META: Metadata = { robots: { index: false, follow: false } };
  if (!hasLocale(routing.locales, locale)) return NOT_FOUND_META;
  const ville = await resolveVilleWithCopy(villeSlug);
  if (!ville || ville.region !== regionSlug) return NOT_FOUND_META;
  const region = getRegion(regionSlug);
  if (!region) return NOT_FOUND_META;
  const isFr = locale === "fr";
  const isPilot = !!ville.copy;

  // Title : 5 services explicites + seoHook sectoriel ville (Audit Will 2026-05-27).
  // Pattern : "[Ville] · IA pour entreprises · audit, formation, implémentation [hook]"
  // Cible 55-65 chars. Si seoHook présent : remplace par hook sectoriel.
  const seoHook = ville.copy?.seoHook?.trim();
  const titleFr = seoHook
    ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · IA pour entreprises · ${seoHook}`
    : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · Audit, formation & implémentation IA`;
  const titleEn = seoHook
    ? `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · AI for businesses · ${seoHook}`
    : `${ville.nameFr} (${ville.departementLabel ?? ville.departement}) · AI audit, training & implementation`;
  const title = isFr ? titleFr : titleEn;

  // Description ≤ 155 chars (cible Google SERP — au-delà → tronqué).
  const truncateForSerp = (s: string, max = 155): string => {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  };
  // Description : si pilote (copy.directAnswer) → directAnswer ville-spécifique.
  // Sinon : pattern explicitant les 5 services Axion-IA + ville + secteur(s) hook.
  // Audit Will 2026-05-27 : éviter description boilerplate, utiliser seoHook pour
  // différencier les 1842 villes qui ont un hook sectoriel auto-généré.
  const fallbackFr = seoHook
    ? `Axion-IA à ${ville.nameFr} (${region.nameFr}) : audit IA, formation, implémentation, coaching 1-to-1 et plateformes web/SaaS pour ${seoHook}. TPE, PME, ETI.`
    : `Axion-IA à ${ville.nameFr} (${region.nameFr}) : audit IA, formation à l'IA, implémentation, coaching 1-to-1 dirigeants et plateformes web/SaaS IA. TPE, PME, ETI.`;
  const fallbackEn = seoHook
    ? `Axion-IA in ${ville.nameFr} (${region.nameFr}): AI audit, training, implementation, 1-to-1 coaching and AI web/SaaS platforms for ${seoHook}. SMBs, mid-market.`
    : `Axion-IA in ${ville.nameFr} (${region.nameFr}): AI audit, training, implementation, 1-to-1 executive coaching and AI web/SaaS platforms. SMBs, mid-market.`;
  const rawDescription = isPilot
    ? isFr
      ? (ville.copy?.directAnswerFr ?? ville.copy?.pitchFr ?? fallbackFr)
      : (ville.copy?.directAnswerEn ?? ville.copy?.pitchEn ?? fallbackEn)
    : isFr
      ? fallbackFr
      : fallbackEn;
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
  // Phasing indexation (Will 2026-05-28) — drip automatique anti scaled-content.
  // Une ville n'est `index:true` que si elle est dans la cohorte indexable du
  // jour (premium d'abord, puis +50/jour). Les villes pas encore dans la cohorte
  // OU sans copy éditorial sortent en `noindex, follow` (page accessible aux
  // humains + liens suivis, mais hors index Google + hors sitemap). La cohorte
  // s'élargissant chaque jour (ISR 24h recalcule), elles basculeront en index:true
  // automatiquement à leur tour. Cohérent avec `getIndexableVilles()` côté sitemap.
  if (!isPilot || !isVilleIndexable(ville.slug)) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

// 5 modules — meta utilisé par la grille du hub.
// Refonte 2026-05-26 (Will) : `mainServiceHref` pointe directement vers la page
// service canonique (`/audit`, `/interventions`, etc.) — les routes ville×verticale
// ont été supprimées (cf. doc en tête de fichier).
interface VerticaleMeta {
  readonly slug: VerticaleSlug;
  readonly labelFr: string;
  readonly labelEn: string;
  readonly descFr: string;
  readonly descEn: string;
  /** Page service canonique vers laquelle le card pointe (FR-canonical). */
  readonly mainServiceHref: string;
}

// Mapping slug verticale ville → id de service SSOT (résolution du VISUEL partagé :
// icône + couleur d'accent). Les hrefs/labels/descriptions restent ceux de la ville
// (ordre propre, `/interventions`, contenu unique par ville = SEO anti-doorway).
const VERTICALE_TO_SERVICE_ID: Record<VerticaleSlug, ServiceId> = {
  audits: "audit",
  interventions: "formations",
  implementations: "implementation",
  "un-a-un": "unAUn",
  "sites-web-ia": "sitesWeb",
};

function buildVerticales(v: string): ReadonlyArray<VerticaleMeta> {
  // Ordre SSOT (formations → 1-to-1 → audit → implémentation → sites web) —
  // identique à la home et à tout le site (décision Will 2026-07-07).
  return [
    {
      slug: "interventions",
      labelFr: "Formations et interventions sur site",
      labelEn: "On-site interventions",
      descFr: `Ateliers et formations IA sur site à ${v} — demi-journée à 2 jours, sur vos données réelles, avec vos équipes. TPE, PME, ETI et grandes entreprises.`,
      descEn: `On-site AI workshops in ${v} — half-day to 2 days, on your real data, with your teams. Micro-businesses, SMBs, mid-market, large enterprises.`,
      mainServiceHref: "/interventions",
    },
    {
      slug: "un-a-un",
      labelFr: "Accompagnement 1-to-1",
      labelEn: "1-to-1 coaching",
      descFr: `Journée 1-to-1 avec Williams à ${v} — cartographie IA de vos processus et 3 chantiers chiffrés, sans engagement. Dirigeants TPE, PME, ETI.`,
      descEn: `1-on-1 day with Williams in ${v} — AI mapping of your processes and 3 costed projects, no commitment. Leaders of SMBs and mid-market.`,
      mainServiceHref: "/un-a-un",
    },
    {
      slug: "audits",
      labelFr: "Audit IA",
      labelEn: "AI Audit",
      descFr: `Diagnostic IA de vos processus à ${v} — 3 chantiers prioritaires chiffrés, roadmap 6 mois, résultat le jour même (Flash) ou en 2-4 semaines (Stratégique). TPE, PME, ETI, grandes entreprises.`,
      descEn: `AI audit in ${v} — 3 costed projects, 6-month roadmap, same-day result (Flash) or 2-4 weeks (Strategic). Micro-businesses, SMBs, mid-market, large enterprises.`,
      mainServiceHref: "/audit",
    },
    {
      slug: "implementations",
      labelFr: "Implémentation IA",
      labelEn: "AI Implementation",
      descFr: `Agents IA, automatisations back-office, CRM/ERP augmentés — livrés en production à ${v}. ROI chiffré avant mission. Toutes tailles d'entreprise.`,
      descEn: `AI agents, back-office automations, augmented CRM/ERP — delivered to production in ${v}. Costed ROI before engagement. All company sizes.`,
      mainServiceHref: "/implementation",
    },
    {
      slug: "sites-web-ia",
      labelFr: "Sites web augmentés IA",
      labelEn: "AI-augmented websites",
      descFr: `Sites web, applications métier et plateformes SaaS augmentées par l'IA — conçus pour vos clients à ${v} et en France. RGPD, hébergement UE.`,
      descEn: `Websites, business apps and AI-augmented SaaS platforms — for your clients in ${v} and across France. GDPR, EU hosting.`,
      mainServiceHref: "/sites-web-augmentes",
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

  // P2 maillage ville (2026-06-21) — articles content-gen tier-1 ancrés sur cette
  // ville (via mentionedCities[]). Croise le hub géographique avec les contenus
  // générés → la page ville gagne en fraîcheur/profondeur (SEO local) et chaque
  // article gagne un lien interne depuis un hub pertinent. Fail-open : helper en
  // try/catch → [] au build stub.invalid ; section rendue UNIQUEMENT s'il y a des
  // articles (zéro section vide, zéro CLS). Tier-1 only (pas de noindex maillé).
  const villeArticles = await getBlogArticlesByVille(ville.slug, loc, 3);

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
      ? `Axion-IA · Architectes IA seniors à ${ville.nameFr}`
      : `Axion-IA · Architectes IA seniors à ${ville.nameFr}`,
    description: isFr ? copy.pitchFr : copy.pitchEn,
    serviceType: isFr ? "Architectes IA seniors B2B" : "Architectes IA seniors B2B",
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

  // Audit Will 2026-05-27 — sameAs ville pour E-E-A-T (Knowledge Graph).
  // Wikipedia FR : URL canonique communauté (existe pour 99.9% des villes >5k hab).
  // Wikidata : URL Special:GoToLinkedPage qui redirige vers le Q-ID Wikidata
  // de la ville à partir de son article Wikipedia FR (mieux que Special:Search).
  const wikiTitle = ville.nameFr.replace(/ /g, "_");
  const cityWikiUrl = `https://fr.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
  const cityWikidataUrl = `https://www.wikidata.org/wiki/Special:GoToLinkedPage?site=frwiki&page=${encodeURIComponent(wikiTitle)}`;

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
    sameAs: [cityWikiUrl, cityWikidataUrl],
  });

  // LocalBusiness / ProfessionalService (Service Area Business safe) — parité avec
  // les pages service×ville (`src/lib/seo/ville-service-jsonld.ts` § 2). Le hub
  // ville n'émettait jusqu'ici qu'un `Service` + un `Place` nu ; on ajoute le
  // ProfessionalService avec `areaServed` = ville pour le signal Local Pack / AI
  // Overviews. IMPORTANT : pas de `geo` ni `openingHours` ni `priceRange` sur le
  // business (Axion-IA = 1 siège FR servant toute la France ; claim de bureau
  // physique par ville = sanction Google « fake local SEO », cf. Sprint correctif
  // P1-1 2026-05-23). Les coordonnées GPS de la VILLE restent portées par le
  // `Place` ci-dessus (légitime : décrit la commune, pas un bureau Axion-IA).
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "ProfessionalService"],
    "@id": `${url}#business`,
    name: isFr
      ? `Axion-IA · Services IA à ${ville.nameFr}`
      : `Axion-IA · AI services in ${ville.nameFr}`,
    description: isFr ? copy.pitchFr : copy.pitchEn,
    url,
    email: "contact@axion-ia.com",
    image: `${SITE_URL}/opengraph-image`,
    address: {
      "@type": "PostalAddress",
      addressLocality: ville.nameFr,
      addressRegion: region.nameFr,
      addressCountry: "FR",
    },
    sameAs: ["https://www.linkedin.com/company/axion-ia-france", cityWikiUrl, cityWikidataUrl],
    parentOrganization: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Axion-IA",
      legalName: "Axion-IA SAS",
      url: SITE_URL,
    },
    areaServed: { "@type": "City", name: ville.nameFr },
    knowsLanguage: ["fr", "en"],
  } as const;

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: path },
    ],
  });

  // ItemList : 5 modules disponibles à cette ville. URLs pointent vers les pages
  // services canoniques (refonte 2026-05-26 — suppression des routes ville×verticale).
  const verticalesItemList = buildItemListJsonLd({
    locale: loc,
    path,
    name: isFr ? `Nos 5 services à ${ville.nameFr}` : `Our 5 services in ${ville.nameFr}`,
    items: verticales.map((v, idx) => ({
      position: idx + 1,
      name: isFr ? v.labelFr : v.labelEn,
      description: isFr ? v.descFr : v.descEn,
      url: `${SITE_URL}/${loc}${v.mainServiceHref}`,
    })),
  });

  // Note Audit Will 2026-05-27 : ancien code `faqSpeakableJsonLd` retiré car
  // jamais émis dans le @graph (code mort). Le Speakable FAQPage est désormais
  // géré inline par `VilleFaqGeolocalisee` (FAQPage JSON-LD avec Speakable sur
  // `[data-faq-q]` + `[data-faq-a]`), et le Speakable hero/directAnswer est
  // porté par le `WebPage` JSON-LD (selectors `[data-speakable-hero]` +
  // `#axion-direct-answer`).

  // AggregateOffer JSON-LD — Prix entry-point des 5 verticales (Will 2026-05-26
  // perfection 2026). Signal AI engine SERP rich snippet (Perplexity, Google AI
  // Overviews) + Google Shopping/Local Pack avec prix inline.
  const auditFlashPrice = getTierById(AUDIT_TIERS, "audit-flash").priceFlat!;
  const auditEtiHighPrice = getTierById(AUDIT_TIERS, "audit-strategique-eti").priceMin!;
  // Aucun prix en dur : le prix d'entrée dérive de la SSOT (getEntryPriceEur ne
  // renvoie jamais undefined pour ces catégories non vides — `!` comme l'audit-flash ci-dessus).
  const interventionEntryPrice = getEntryPriceEur(INTERVENTION_TIERS)!;
  const unAUnEntryPrice = getEntryPriceEur(UN_A_UN_TIERS)!;
  const implEntryPrice = getEntryPriceEur(IMPLEMENTATION_TIERS)!;

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
        name: "Formation IA collective sur site",
        price: interventionEntryPrice,
        priceCurrency: "EUR",
        url: `${SITE_URL}/${loc}/formations`,
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

  // Hero image : custom ville si dispo, sinon fallback universel (Audit Will 2026-05-27).
  // 58 villes T1/T2 ont leur photo hero dédiée (AVIF + WebP + JPG dans /public/villes-hero/).
  // Les autres villes utilisent l'illustration triangle "3 piliers" universelle.
  const hasCustomHeroImage = hasVilleHeroImage(ville.slug);
  const heroImageSrc = hasCustomHeroImage
    ? `/villes-hero/${ville.slug}.avif`
    : `/images/axion-ia-ville-hero-triangle-3-piliers-temps-couts-resultats-carre.avif`;
  const heroImageAlt = hasCustomHeroImage
    ? isFr
      ? `${ville.nameFr} — vue représentative du tissu économique local accompagné par Axion-IA (audit, formation, implémentation, coaching, plateformes web/SaaS IA).`
      : `${ville.nameFr} — representative view of the local economic ecosystem supported by Axion-IA (AI audit, training, implementation, coaching, web/SaaS platforms).`
    : isFr
      ? `Triangle Axion-IA des 3 piliers à ${ville.nameFr} : gagnez du temps, réduisez vos coûts, maximisez vos résultats — 100 % gagnant, moins de complexité, plus de performance.`
      : `Axion-IA 3 pillars triangle in ${ville.nameFr}: save time, cut costs, maximize results.`;
  const heroImageCaption = hasCustomHeroImage
    ? isFr
      ? `${ville.nameFr} · accompagné par Axion-IA`
      : `${ville.nameFr} · supported by Axion-IA`
    : isFr
      ? `Axion-IA · 3 piliers à ${ville.nameFr}`
      : `Axion-IA · 3 pillars in ${ville.nameFr}`;

  // ImageObject JSON-LD — Hero image ville-spécifique ou universelle.
  // Signal Google Images + AI engines pour indexation visuelle locale.
  // Licence CC BY 4.0 (cohérent avec /galerie banque d'images Axion-IA).
  const heroImageJsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "@id": `${SITE_URL}${path}#hero-image`,
    contentUrl: `${SITE_URL}${heroImageSrc}`,
    url: `${SITE_URL}${heroImageSrc}`,
    name: heroImageCaption,
    description: heroImageAlt,
    width: hasCustomHeroImage ? 1200 : 1254,
    height: hasCustomHeroImage ? 1200 : 1254,
    encodingFormat: "image/avif",
    creator: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Axion-IA" },
    copyrightHolder: { "@type": "Organization", name: "Axion-IA" },
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
                {isFr ? `Architectes IA · ${ville.nameFr}` : `AI experts · ${ville.nameFr}`}
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
              {/* Sous-ligne hero reformulée Will 2026-05-27 (audit perfection) —
                  wording orienté valeur explicite ("structurez et déployez l'IA")
                  vs ancien "cabinet d'experts IA" qui pouvait être confondu
                  avec architecte bâtiment. Mention des 5 services intégrée pour
                  intent SEO + AEO immédiat. */}
              <p
                className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl"
                data-speakable-hero
              >
                {isFr
                  ? "Structurez et déployez l'IA dans votre entreprise à "
                  : "Structure and deploy AI in your business in "}
                <span className="text-fg font-semibold">
                  {ville.nameFr} {isFr ? "et alentours" : "and surroundings"}
                </span>
                {isFr
                  ? " : audit IA, formation à l'IA pour vos équipes, implémentation, coaching 1-to-1 dirigeants et plateformes/SaaS web IA. De la TPE à l'ETI."
                  : ": AI audit, AI training for your teams, implementation, 1-to-1 executive coaching and AI web/SaaS platforms. From SME to mid-market."}
              </p>
              {/* Badges 5 services — pills TEINTÉS par service (icône + couleur
                  d'accent SSOT services-visual.ts). Cohérent avec la grille ci-dessous
                  et le reste du site (home/visibilité/presse). */}
              <ul
                aria-label={isFr ? "Nos 5 services" : "Our 5 services"}
                className="mt-6 flex flex-wrap gap-2"
              >
                {(
                  [
                    { id: "formations", labelFr: "Formation", labelEn: "Training" },
                    { id: "unAUn", labelFr: "Coaching 1-to-1", labelEn: "1-to-1 coaching" },
                    { id: "audit", labelFr: "Audit IA", labelEn: "AI audit" },
                    { id: "implementation", labelFr: "Implémentation", labelEn: "Implementation" },
                    { id: "sitesWeb", labelFr: "Web / SaaS IA", labelEn: "AI Web / SaaS" },
                  ] as const
                ).map(({ id, labelFr, labelEn }) => {
                  const { Icon, accent } = SERVICE_VISUAL[id];
                  return (
                    <li
                      key={id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold tracking-tight",
                        ACCENT_CLASSES[accent].chip,
                      )}
                    >
                      <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                      {isFr ? labelFr : labelEn}
                    </li>
                  );
                })}
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
            {/* Colonne droite — illustration hero ville (Audit Will 2026-05-27) :
                - 58 villes ont leur photo dédiée AVIF/WebP/JPG dans /villes-hero/
                  (Paris, Lyon, Marseille, Aix-en-Provence, Saint-Marcellin, etc.)
                - Autres villes : fallback universel triangle 3 piliers Axion-IA
                Format AVIF priority LCP, aspect 1:1, alt ville-spécifique. */}
            <div className="hidden lg:block">
              <Illustration
                slot="VILLE-01-hero"
                src={heroImageSrc}
                aspectRatio="1:1"
                filenameTarget={`public${heroImageSrc}`}
                alt={heroImageAlt}
                caption={heroImageCaption}
                priority
              />
            </div>
          </div>
        </Container>
      </section>

      {/* ── Grille 5 verticales — JUSTE après le hero (Will 2026-05-26).
            Le visiteur voit immédiatement les 5 prestations dispo à sa ville,
            avant les logos clients et le bandeau contact. ── */}
      <section
        id="ville-verticales"
        aria-labelledby="ville-verticales-heading"
        className="bg-paper border-border border-t py-16 sm:py-20 lg:py-24"
      >
        <Container>
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="text-terracotta mb-5 text-sm font-bold tracking-[0.2em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-2 w-2 rounded-full align-middle" />
              {isFr ? "Nos 5 services" : "Our 5 services"}
            </p>
            <h2
              id="ville-verticales-heading"
              className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.04] font-semibold tracking-tight"
            >
              {isFr ? "Nos 5 services à" : "Our 5 services in"}{" "}
              <span
                className="italic-editorial text-terracotta"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {ville.nameFr}.
              </span>
            </h2>
            <p className="text-fg-soft mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
              {isFr
                ? "Audit IA, formations et interventions sur site, implémentation, accompagnement 1-to-1 dirigeants, sites web et plateformes SaaS IA. Adapté aux TPE, PME, ETI et grandes entreprises."
                : "Audit, on-site engagement, implementation, 1-to-1 coaching, AI-augmented websites. Adapted to micro-businesses, SMBs, mid-market and large enterprises."}
            </p>
          </div>

          {/* Grille centralisée — même design que la home (variante showcase :
              fond teinté par service, puce pleine, icône SSOT, 3/ligne). Les items
              gardent l'ordre, les hrefs (`/interventions`), les labels et surtout
              les DESCRIPTIONS uniques par ville (SEO anti-doorway) + le tracking. */}
          <ServicesGrid
            variant="showcase"
            isFr={isFr}
            items={verticales.map((v) => ({
              serviceId: VERTICALE_TO_SERVICE_ID[v.slug],
              href: v.mainServiceHref,
              title: isFr ? v.labelFr : v.labelEn,
              data: { "data-source-ville": ville.slug, "data-service-module": v.slug },
              key: v.slug,
            }))}
            renderBody={({ index, accent }) => {
              const v = verticales[index];
              if (!v) return null;
              return (
                <>
                  <p className="text-fg-soft mt-4 text-sm leading-relaxed">
                    {isFr ? v.descFr : v.descEn}
                  </p>
                  <div className="flex-1" />
                  <span
                    className={cn(
                      "border-fg/10 mt-6 inline-flex items-center gap-2 border-t pt-4 text-sm font-semibold transition-colors",
                      accent.text,
                    )}
                  >
                    {isFr ? "Découvrir le module" : "Discover the module"}
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

      {/* ── Bandeau logos clients — preuve sociale après les 5 modules ── */}
      <ClientLogosBand isFr={isFr} />

      {/* ── Bandeau orange contact — placé juste après les logos (Will 2026-05-26)
            pour capter l'attention immédiate post-services. ── */}
      <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />

      {/* ── Section fondateur Williams — DÉPLACÉE juste après le bandeau
            orange (Will 2026-05-26). « On ne promet pas l'excellence. On la livre. »
            arrive en renforcement immédiat de l'engagement contact. ── */}
      <FounderTrustSection isFr={isFr} />

      {/* ── Section tarifs « Un prix de départ pour chaque service » —
            ajoutée juste après le fondateur (Will 2026-05-26). Reprise du
            patron home, légèrement adaptée à la ville. ── */}
      <PricingGridVille isFr={isFr} villeNameFr={ville.nameFr} loc={loc} />

      {/* ── Écosystème économique local (composant ville Phase 4) ── */}
      <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} />

      {/* ── Tissu économique : secteurs, opportunités IA (composant ville Phase 4) ── */}
      <VilleTissuEconomique ville={ville} isFr={isFr} />

      {/* ── Communes proches (composant ville Phase 4) — sans verticale → liens hub ── */}
      <VilleCommunesProches ville={ville} isFr={isFr} />

      {/* ── FAQ ville-spécifique (composant ville Phase 4) ── */}
      <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />

      {/* ── P2 maillage ville (2026-06-21) — « Contenus IA à {Ville} » : articles
            content-gen tier-1 ancrés sur la ville. Rendu UNIQUEMENT s'il y en a
            (pas de section vide). Croise le hub géo ↔ le blog généré. ── */}
      {villeArticles.length > 0 ? (
        <Section
          eyebrow={isFr ? "Ressources locales" : "Local resources"}
          title={isFr ? `Contenus IA à ${ville.nameFr}` : `AI content for ${ville.nameFr}`}
        >
          <Container>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {villeArticles.map((a) => (
                <li key={a.id}>
                  <ArticleCard
                    href={a.slug.startsWith("guide-") ? `/guides/${a.slug}` : `/blog/${a.slug}`}
                    title={a.title}
                    excerpt={a.excerpt ?? ""}
                    {...(a.publishedAt
                      ? { publishedAt: a.publishedAt.toISOString().slice(0, 10) }
                      : {})}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

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
            <p
              id="axion-direct-answer"
              data-speakable-hero
              data-answer
              className="text-fg-soft mx-auto mt-4 max-w-2xl text-sm leading-relaxed sm:text-base"
            >
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

      {/* JSON-LD globaux page — schemas @graph, afterInteractive (-300 ms TBT).
          WebPage relie tous les schemas via isPartOf vers l'Organization root
          (signal hiérarchique fort pour LLMs / AI Overviews).
          Note : VilleFaqGeolocalisee émet déjà son propre FAQPage JSON-LD inline,
          on n'ajoute donc pas faqSpeakableJsonLd au @graph (anti-doublon Google).
          Speakable est porté ici par le WebPage (selectors hero + direct-answer). */}
      <JsonLdGraph
        schemas={[
          buildWebPageJsonLd({
            locale: loc,
            path,
            name: isFr
              ? `Axion-IA · Architectes IA seniors à ${ville.nameFr}`
              : `Axion-IA · AI experts in ${ville.nameFr}`,
            description: isFr ? copy.pitchFr : copy.pitchEn,
            inLanguage: loc === "fr" ? "fr-FR" : "en-GB",
            isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
            about: { "@type": "City", name: ville.nameFr },
            breadcrumb: { "@id": `${url}#breadcrumb` },
            speakable: { selectors: ["[data-speakable-hero]", "#axion-direct-answer"] },
            datePublished: "2026-05-26",
            // Audit fraîcheur 2026-06-08 : dateModified figé sur la date de refonte
            // (= datePublished). Le contenu d'une page ville ne change pas entre deux
            // deploys ; auparavant `BUILD_DATE` faisait glisser dateModified à chaque
            // build, en contradiction avec datePublished figé = empreinte pSEO de masse.
            // Bumper À LA MAIN cette date si le contenu des villes est réellement refondu.
            dateModified: "2026-05-26",
            extra: { primaryImageOfPage: { "@id": `${url}#hero-image` } },
          }),
          serviceJsonLd,
          placeJsonLd,
          localBusinessJsonLd,
          breadcrumbJsonLd,
          verticalesItemList,
          heroImageJsonLd,
          aggregateOfferJsonLd,
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
