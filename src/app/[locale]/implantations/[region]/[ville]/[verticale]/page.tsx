/**
 * Page publique landing-ville × verticale — DISPATCHER (Sprint A · Phase 5).
 *
 * Route : `/[locale]/implantations/[region]/[ville]/[verticale]`
 * Verticales : `interventions` | `audits` | `implementations` | `un-a-un` | `sites-web-ia`
 *
 * Dispatcher fin (~400 LOC) qui orchestre les composants services Phase 2
 * (`src/components/services/{audit,interventions,implementation,un-a-un,sites-web}/`)
 * + composants ville Phase 4 (`src/components/ville/`). Réutilisation totale :
 * mêmes composants que la page hub `/fr/{service}`, paramétrés par `villeContext`.
 *
 * ⚠️ Edge case E5 anti-saturation build GH Actions : `generateStaticParams`
 * retourne uniquement les ~100 villes pilotes (top par population). Les routes
 * restantes (10 000+) sont rendues ISR-on-demand (`dynamicParams = true`,
 * `revalidate = 86400`).
 *
 * Article LLM ville-spécifique récupéré via `getLandingVilleArticleByVertical`
 * — pour FAQ ville-spécifique uniquement (3 entrées max passées aux composants
 * `*Faq` et à `VilleFaqGeolocalisee`). Si Article absent → stub minimal noindex
 * (anti-doorway HCU 2024).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { getRegion } from "@/content/regions";
import { getVille } from "@/content/villes";
import type { Ville } from "@/content/villes";
import type { City } from "@/lib/cities";
import {
  buildProductMetadata,
  buildBreadcrumbJsonLd,
  buildServiceJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { LANDING_VILLE_VERTICAL_SLUGS } from "@/server/content-gen/generators/landing-ville-shared";
import type { LandingVilleVerticalSlug } from "@/server/content-gen/generators/landing-ville-shared";
import { getLandingVilleArticleByVertical } from "@/server/content-gen/landing-ville/get-article-by-vertical";

import type { VilleContext } from "@/components/services/types";

// ─── Services Phase 2 ────────────────────────────────────────────────────────
// Audit (8)
import { AuditHero } from "@/components/services/audit/AuditHero";
import { AuditTrustPills } from "@/components/services/audit/AuditTrustPills";
import { AuditTierGrid } from "@/components/services/audit/AuditTierGrid";
import { AuditMaturityLevels } from "@/components/services/audit/AuditMaturityLevels";
import { AuditCrossModules } from "@/components/services/audit/AuditCrossModules";
import { AuditMethodology } from "@/components/services/audit/AuditMethodology";
import { AuditFaq } from "@/components/services/audit/AuditFaq";
import { AuditCtaBlock } from "@/components/services/audit/AuditCtaBlock";
// Interventions (7)
import { InterventionsHero } from "@/components/services/interventions/InterventionsHero";
import { InterventionsAudienceStrip } from "@/components/services/interventions/InterventionsAudienceStrip";
import { InterventionsFamiliesGrid } from "@/components/services/interventions/InterventionsFamiliesGrid";
import { InterventionsReservationFlow } from "@/components/services/interventions/InterventionsReservationFlow";
import { InterventionsMaturityLevels } from "@/components/services/interventions/InterventionsMaturityLevels";
import { InterventionsCrossModules } from "@/components/services/interventions/InterventionsCrossModules";
import { InterventionsFaq } from "@/components/services/interventions/InterventionsFaq";
// Implementation (10)
import { ImplementationHero } from "@/components/services/implementation/ImplementationHero";
import { ImplementationTrustPills } from "@/components/services/implementation/ImplementationTrustPills";
import { ImplementationPillarChoices } from "@/components/services/implementation/ImplementationPillarChoices";
import { ImplementationCatalogFunctions } from "@/components/services/implementation/ImplementationCatalogFunctions";
import { ImplementationPricingTiers } from "@/components/services/implementation/ImplementationPricingTiers";
import { ImplementationScenariosBySize } from "@/components/services/implementation/ImplementationScenariosBySize";
import { ImplementationProcessSteps } from "@/components/services/implementation/ImplementationProcessSteps";
import { ImplementationFaq } from "@/components/services/implementation/ImplementationFaq";
import { ImplementationCtaBlock } from "@/components/services/implementation/ImplementationCtaBlock";
// Un-a-un (5)
import { UnAUnHero } from "@/components/services/un-a-un/UnAUnHero";
import { UnAUnTarget } from "@/components/services/un-a-un/UnAUnTarget";
import { UnAUnMethodology } from "@/components/services/un-a-un/UnAUnMethodology";
import { UnAUnFaq } from "@/components/services/un-a-un/UnAUnFaq";
import { UnAUnCtaBlock } from "@/components/services/un-a-un/UnAUnCtaBlock";
// Sites-web (6)
import { SitesWebHero } from "@/components/services/sites-web/SitesWebHero";
import { SitesWebTrustPills } from "@/components/services/sites-web/SitesWebTrustPills";
import { SitesWebStackAdaptee } from "@/components/services/sites-web/SitesWebStackAdaptee";
import { SitesWebMethodology } from "@/components/services/sites-web/SitesWebMethodology";
import { SitesWebFaq } from "@/components/services/sites-web/SitesWebFaq";
import { SitesWebCtaBlock } from "@/components/services/sites-web/SitesWebCtaBlock";

// ─── Ville Phase 4 ───────────────────────────────────────────────────────────
import { VilleEcosystemeLocal } from "@/components/ville/VilleEcosystemeLocal";
import { VilleCommunesProches } from "@/components/ville/VilleCommunesProches";
import { VilleFaqGeolocalisee } from "@/components/ville/VilleFaqGeolocalisee";
import { OrangeContactBanner } from "@/components/ville/OrangeContactBanner";
// ─────────────────────────────────────────────────────────────────────────────

import { VILLES } from "@/content/villes";

interface Props {
  params: Promise<{ locale: string; region: string; ville: string; verticale: string }>;
}

// Edge case E5 — top ~100 villes pilotes par population. Empêche le build GH
// Actions de saturer à 10 750 routes SSG. Les ~10 250 restantes sont ISR-on-demand
// via `dynamicParams = true` au premier hit utilisateur.
export function generateStaticParams(): Array<{
  region: string;
  ville: string;
  verticale: string;
}> {
  const top100 = [...VILLES].sort((a, b) => b.population - a.population).slice(0, 100);
  return top100.flatMap((v) =>
    LANDING_VILLE_VERTICAL_SLUGS.map((vertical) => ({
      region: v.region,
      ville: v.slug,
      verticale: vertical,
    })),
  );
}

export const revalidate = 86400;
export const dynamicParams = true;

const VERTICAL_LABEL_FR: Record<LandingVilleVerticalSlug, string> = {
  interventions: "Interventions terrain",
  audits: "Audit IA d'optimisation",
  implementations: "Implémentation IA",
  "un-a-un": "Accompagnement 1-to-1",
  "sites-web-ia": "Sites web & digital IA",
};

const VERTICAL_CTA_HREF: Record<LandingVilleVerticalSlug, string> = {
  interventions: "/interventions",
  audits: "/audit",
  implementations: "/implementation",
  "un-a-un": "/un-a-un",
  "sites-web-ia": "/sites-web-augmentes",
};

function isValidVertical(value: string): value is LandingVilleVerticalSlug {
  return (LANDING_VILLE_VERTICAL_SLUGS as ReadonlyArray<string>).includes(value);
}

/**
 * Adapte le `Ville` (composite SSOT TS `@/content/villes`) en `City` attendu
 * par `VilleEcosystemeLocal` (qui consomme le modèle Prisma `@/lib/cities`).
 * Les deux types partagent la donnée essentielle (slug/population/insee/geo) ;
 * seuls les noms de champs diffèrent (nameFr ↔ name, region ↔ regionSlug,
 * departement ↔ departmentCode). Pas de DB call — adapter pur en mémoire.
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
  const { locale, region: regionSlug, ville: villeSlug, verticale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (!isValidVertical(verticale)) return {};
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) return {};
  const region = getRegion(regionSlug);
  if (!region) return {};
  const isFr = locale === "fr";

  const article = await getLandingVilleArticleByVertical(ville.slug, verticale, locale as Locale);

  const verticalLabel = VERTICAL_LABEL_FR[verticale];
  // Le layout root applique `template: "%s · Axion-IA"` — on N'AJOUTE PAS
  // "· Axion-IA" ici sinon le title devient "... · Axion-IA · Axion-IA".
  const title = article?.metaTitle
    ? article.metaTitle.replace(/\s*·\s*Axion-IA\s*$/i, "")
    : isFr
      ? `${verticalLabel} à ${ville.nameFr}`
      : `${verticalLabel} in ${ville.nameFr}`;
  const description = article?.metaDescription
    ? article.metaDescription
    : isFr
      ? `Axion-IA propose ${verticalLabel.toLowerCase()} à ${ville.nameFr} (${region.nameFr}). Tarifs publics, intervention rapide, ROI chiffré.`
      : `Axion-IA delivers ${verticalLabel.toLowerCase()} in ${ville.nameFr} (${region.nameFr}). Public pricing, fast intervention, costed ROI.`;

  const meta = buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}/${ville.slug}/${verticale}`,
    title,
    description,
  });

  // Override title en mode `absolute` pour bypass le `template: "%s · Axion-IA"`
  // si le metaTitle LLM contient déjà "Axion-IA" (anti-doublon).
  const titleWithBrand = /axion[- ]?ia/i.test(title) ? title : `${title} · Axion-IA`;
  const metaWithAbsoluteTitle: Metadata = { ...meta, title: { absolute: titleWithBrand } };

  // Anti-doorway HCU 2024 — si pas d'Article OU tier_3 → noindex.
  const shouldNoindex = !article || article.indexationTier === "tier_3_noindex_nofollow";
  if (shouldNoindex) {
    return { ...metaWithAbsoluteTitle, robots: { index: false, follow: true } };
  }
  return metaWithAbsoluteTitle;
}

export default async function VilleVerticalePage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug, verticale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (!isValidVertical(verticale)) notFound();
  const ville = getVille(villeSlug);
  if (!ville || ville.region !== regionSlug) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const verticalLabel = VERTICAL_LABEL_FR[verticale];
  const ctaHref = VERTICAL_CTA_HREF[verticale];

  const breadcrumbItems = [
    { href: "/implantations", label: isFr ? "Implantations" : "Locations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
    { href: `/implantations/${region.slug}/${ville.slug}`, label: ville.nameFr },
    {
      href: `/implantations/${region.slug}/${ville.slug}/${verticale}`,
      label: verticalLabel,
    },
  ];

  const article = await getLandingVilleArticleByVertical(ville.slug, verticale, loc);

  const path = `/implantations/${region.slug}/${ville.slug}/${verticale}` as `/${string}`;
  const url = `${SITE_URL}/${loc}${path}`;

  // ─── Stub minimal noindex si Article absent (anti-doorway HCU 2024) ───────
  if (!article) {
    return (
      <Section
        eyebrow={isFr ? `Implantations · ${region.nameFr}` : `Locations · ${region.nameFr}`}
        title={isFr ? `${verticalLabel} à` : `${verticalLabel} in`}
        titleEm={ville.nameFr}
        description={
          isFr
            ? `La page locale détaillée pour ${verticalLabel.toLowerCase()} à ${ville.nameFr} est en cours de génération. En attendant, retrouvez tous nos services via la page ville.`
            : `The detailed local page for ${verticalLabel.toLowerCase()} in ${ville.nameFr} is being generated. Meanwhile, find all our services via the city page.`
        }
        titleAs="h1"
      >
        <div className="mb-8">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Cta
            href={`/implantations/${region.slug}/${ville.slug}` as never}
            variant="primary"
            size="lg"
            shape="pill"
            track="ville_vertical_stub_back_ville"
          >
            {isFr
              ? `Voir tous les services à ${ville.nameFr}`
              : `See all services in ${ville.nameFr}`}
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Cta>
          <Cta
            href={ctaHref as never}
            variant="ghost"
            size="lg"
            shape="pill"
            track="ville_vertical_stub_cta_global"
          >
            {isFr ? `Découvrir ${verticalLabel}` : `Discover ${verticalLabel}`}
          </Cta>
        </div>
        <AiContentDisclaimer locale={loc} className="mt-8" />
      </Section>
    );
  }

  // ─── Article publié : rendu dispatcher complet ────────────────────────────

  // VilleContext partagé pour tous les composants services.
  const villeContext: VilleContext = {
    name: ville.nameFr,
    region: region.nameFr,
    regionSlug: region.slug,
    villeSlug: ville.slug,
    inseeCode: ville.inseeCode,
    population: ville.population,
  };

  // Adapter Ville → City pour VilleEcosystemeLocal (signature lib/cities).
  const villeAsCity = adaptVilleToCity(ville, region.nameFr);

  // FAQ ville-spécifiques LLM (≤ 3 entrées passées aux composants Faq services
  // + VilleFaqGeolocalisee). Parse `article.faqJson` qui supporte 2 formats :
  // V1 legacy `[{q,a}, ...]` ou V2 `{ version:2, faq:[{q,a},...] }`.
  type RawFaq = { q?: string; question?: string; a?: string; answer?: string };
  type StructuredV2 = { readonly faq?: ReadonlyArray<RawFaq> };
  const rawFaqJson = article.faqJson as unknown;
  const structuredV2: StructuredV2 | null =
    rawFaqJson && typeof rawFaqJson === "object" && !Array.isArray(rawFaqJson)
      ? (rawFaqJson as StructuredV2)
      : null;
  const rawFaqArray: ReadonlyArray<RawFaq> = structuredV2?.faq
    ? structuredV2.faq
    : Array.isArray(rawFaqJson)
      ? (rawFaqJson as ReadonlyArray<RawFaq>)
      : [];
  const villeSpecificFaqs: ReadonlyArray<{ q: string; a: string }> = rawFaqArray
    .map((f) => ({
      q: (f.q ?? f.question ?? "").trim(),
      a: (f.a ?? f.answer ?? "").trim(),
    }))
    .filter((f) => f.q.length > 0 && f.a.length > 0)
    .slice(0, 3);

  // ─── JSON-LD globaux page (Service + Breadcrumb + WebPage) ────────────────
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path,
    name: isFr
      ? `${verticalLabel} à ${ville.nameFr} · Axion-IA`
      : `${verticalLabel} in ${ville.nameFr} · Axion-IA`,
    description: article.directAnswer ?? article.excerpt ?? article.title,
    serviceType: isFr
      ? `Cabinet IA opérationnel · ${verticalLabel}`
      : `Operational AI · ${verticalLabel}`,
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

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Implantations" : "Locations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: `/implantations/${region.slug}/${ville.slug}` },
      { name: verticalLabel, href: path },
    ],
  });

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: article.metaTitle ?? article.title,
    description: (article.metaDescription ?? article.directAnswer ?? "").slice(0, 300),
    inLanguage: loc,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    datePublished: article.publishedAt?.toISOString(),
  } as const;

  return (
    <>
      <Container>
        <div className="pt-6 pb-2">
          <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
        </div>
      </Container>

      {verticale === "audits" && (
        <>
          <AuditHero isFr={isFr} villeContext={villeContext} />
          <AuditTrustPills isFr={isFr} />
          <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} verticale="audits" />
          <AuditTierGrid isFr={isFr} villeContext={villeContext} />
          <AuditMaturityLevels isFr={isFr} villeContext={villeContext} />
          <AuditMethodology isFr={isFr} />
          <VilleCommunesProches ville={ville} verticale="audits" isFr={isFr} />
          <AuditFaq isFr={isFr} villeContext={villeContext} villeSpecificFaqs={villeSpecificFaqs} />
          <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />
          <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
          <AuditCrossModules isFr={isFr} />
          <AuditCtaBlock isFr={isFr} villeContext={villeContext} />
        </>
      )}

      {verticale === "interventions" && (
        <>
          <InterventionsHero isFr={isFr} villeContext={villeContext} />
          <InterventionsAudienceStrip isFr={isFr} />
          <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} verticale="interventions" />
          <InterventionsFamiliesGrid isFr={isFr} villeContext={villeContext} />
          <InterventionsReservationFlow isFr={isFr} villeContext={villeContext} />
          <InterventionsMaturityLevels isFr={isFr} villeContext={villeContext} />
          <VilleCommunesProches ville={ville} verticale="interventions" isFr={isFr} />
          <InterventionsFaq
            isFr={isFr}
            villeContext={villeContext}
            villeSpecificFaqs={villeSpecificFaqs}
          />
          <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />
          <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
          <InterventionsCrossModules isFr={isFr} />
        </>
      )}

      {verticale === "implementations" && (
        <>
          <ImplementationHero isFr={isFr} villeContext={villeContext} />
          <ImplementationTrustPills isFr={isFr} />
          <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} verticale="implementations" />
          <ImplementationPillarChoices isFr={isFr} />
          <ImplementationCatalogFunctions isFr={isFr} villeContext={villeContext} />
          <ImplementationPricingTiers isFr={isFr} villeContext={villeContext} />
          <ImplementationScenariosBySize isFr={isFr} villeContext={villeContext} />
          <ImplementationProcessSteps isFr={isFr} />
          <VilleCommunesProches ville={ville} verticale="implementations" isFr={isFr} />
          <ImplementationFaq
            isFr={isFr}
            villeContext={villeContext}
            villeSpecificFaqs={villeSpecificFaqs}
          />
          <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />
          <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
          <ImplementationCtaBlock isFr={isFr} villeContext={villeContext} />
        </>
      )}

      {verticale === "un-a-un" && (
        <>
          <UnAUnHero isFr={isFr} villeContext={villeContext} />
          <UnAUnTarget isFr={isFr} />
          <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} verticale="un-a-un" />
          <UnAUnMethodology isFr={isFr} />
          <VilleCommunesProches ville={ville} verticale="un-a-un" isFr={isFr} />
          <UnAUnFaq isFr={isFr} villeContext={villeContext} villeSpecificFaqs={villeSpecificFaqs} />
          <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />
          <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
          <UnAUnCtaBlock isFr={isFr} villeContext={villeContext} />
        </>
      )}

      {verticale === "sites-web-ia" && (
        <>
          <SitesWebHero isFr={isFr} villeContext={villeContext} />
          <SitesWebTrustPills isFr={isFr} />
          <VilleEcosystemeLocal ville={villeAsCity} isFr={isFr} verticale="sites-web-ia" />
          <SitesWebStackAdaptee isFr={isFr} villeContext={villeContext} />
          <SitesWebMethodology isFr={isFr} />
          <VilleCommunesProches ville={ville} verticale="sites-web-ia" isFr={isFr} />
          <SitesWebFaq
            isFr={isFr}
            villeContext={villeContext}
            villeSpecificFaqs={villeSpecificFaqs}
          />
          <VilleFaqGeolocalisee villeContext={villeContext} faqs={villeSpecificFaqs} isFr={isFr} />
          <OrangeContactBanner isFr={isFr} villeSlug={ville.slug} />
          <SitesWebCtaBlock isFr={isFr} villeContext={villeContext} />
        </>
      )}

      <AiContentDisclaimer locale={loc} />

      <JsonLdGraph
        schemas={[serviceJsonLd, breadcrumbJsonLd, webPageJsonLd]}
        strategy="afterInteractive"
        scriptId={`jsonld-ville-vertical-${ville.slug}-${verticale}`}
      />
    </>
  );
}
