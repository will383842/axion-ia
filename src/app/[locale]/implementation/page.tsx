/**
 * /[locale]/implementation — Page hub Implémentation IA (Module 3).
 *
 * Sprint A · Phase 3 Refactor-3 (Will 2026-05-25) — la page est désormais un
 * assemblage des composants `src/components/services/implementation/*` extraits
 * en Phase 2. La page hub n'injecte PAS de `villeContext` (cf. Phase 5 pour
 * les ~430 routes ville `/fr/implantations/{region}/{ville}/implementations`).
 *
 * Reste inline ici (par design) :
 * - `generateMetadata` (SEO product canonical hub)
 * - `revalidate = 3600` (ISR 1 h)
 * - `setRequestLocale(locale)` + check `hasLocale`
 * - Breadcrumbs visuel + JSON-LD intégré
 * - Service JSON-LD avec `hasOfferCatalog` (9 offres)
 * - `LocalCoverageSection` + `LocalGeoFaqSection` (pSEO — Sprint 14.9)
 * - `StickyMobileCta`
 * - Closing illustration `IMPL-03-closing` (Visual Rhythm 2026)
 *
 * SSOT prix : `@/content/pricing` — aucun montant hardcodé.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Illustration } from "@/components/visual/Illustration";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  formatAmount,
  getEntryPriceEur,
  getTierById,
} from "@/content/pricing";
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { ImplementationHero } from "@/components/services/implementation/ImplementationHero";
import { ImplementationTrustPills } from "@/components/services/implementation/ImplementationTrustPills";
import { ImplementationPillarChoices } from "@/components/services/implementation/ImplementationPillarChoices";
import { ImplementationCatalogFunctions } from "@/components/services/implementation/ImplementationCatalogFunctions";
import { ImplementationPricingTiers } from "@/components/services/implementation/ImplementationPricingTiers";
import { ImplementationComparisonMatrix } from "@/components/services/implementation/ImplementationComparisonMatrix";
import { ImplementationScenariosBySize } from "@/components/services/implementation/ImplementationScenariosBySize";
import { ImplementationProcessSteps } from "@/components/services/implementation/ImplementationProcessSteps";
import { ImplementationFaq } from "@/components/services/implementation/ImplementationFaq";
import { ImplementationCtaBlock } from "@/components/services/implementation/ImplementationCtaBlock";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  // « Mise en route IA » entry-level — aligné sur intervention-essentielle
  // (490 €) qui correspond à la prestation « première automatisation simple ».
  // TODO(pricing): valider mapping avec Will (intervention-essentielle vs impl-poc 990 €).
  const entryAutomatisation = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    loc,
    { compact: true },
  );
  return buildProductMetadata({
    locale,
    path: "/implementation",
    title:
      loc === "fr"
        ? "Implémentation IA · Catalogue par fonction · Axion-IA"
        : "AI implementation · Catalogue by function · Axion-IA",
    description:
      loc === "fr"
        ? `Automatisations IA par fonction (service client, ventes, RH, données…). Forfait fixe dès ${entryAutomatisation}, sans abonnement, livraison 2-6 semaines. Résultats mesurables.`
        : `AI automations by function (customer service, sales, HR, data…). Fixed fee from ${entryAutomatisation}, no subscription, 2-6 week delivery. Measurable results.`,
  });
}

export default async function ImplementationListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [
    {
      href: "/implementation",
      label: isFr ? "Implémentation IA" : "AI implementation",
    },
  ];

  // Service JSON-LD avec areasServed multi-régions (Sprint 14.9 levier 2)
  // + hasOfferCatalog (9 offres) — reste inline car spécifique à la page hub.
  const serviceJsonLd = {
    ...buildServiceJsonLd({
      locale: loc,
      path: "/implementation",
      name: isFr
        ? "Implémentation IA opérationnelle · Axion-IA"
        : "Operational AI implementation · Axion-IA",
      description: isFr
        ? `Mise en production de cas IA opérationnels en 6 à 12 semaines : agents conversationnels, automatisation back-office, intégration CRM/ERP, IA custom. ROI chiffré, formation incluse, dès ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "fr")}.`
        : `Production deployment of operational AI cases in 6 to 12 weeks: conversational agents, back-office automation, CRM/ERP integration, custom AI. Costed ROI, training included, from ${formatAmount(getTierById(IMPLEMENTATION_TIERS, "impl-poc").priceMin!, "en")}.`,
      serviceType: "AI implementation",
      priceEur: getEntryPriceEur(IMPLEMENTATION_TIERS) ?? 0,
      areasServed: buildServiceAreasServed(loc),
    }),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: isFr
        ? "Services d'implémentation IA · Axion-IA"
        : "AI implementation services · Axion-IA",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: isFr ? "IA Custom" : "Custom AI" },
        },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Chatbot RAG" } },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Automatisation processus" : "Process automation",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Structuration données" : "Data structuring",
          },
        },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "CRM / ERP IA" } },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: isFr ? "Documents IA" : "AI Documents" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: isFr ? "Agents IA" : "AI Agents" },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: isFr ? "Intégrations" : "Integrations" },
        },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "No-code IA" } },
      ],
    },
  };

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <ImplementationHero isFr={isFr} />
      <ImplementationTrustPills isFr={isFr} />
      <ImplementationPillarChoices isFr={isFr} />
      <ImplementationCatalogFunctions isFr={isFr} />
      <ImplementationPricingTiers isFr={isFr} />
      <ImplementationComparisonMatrix isFr={isFr} />
      <ImplementationScenariosBySize isFr={isFr} />
      <ImplementationProcessSteps isFr={isFr} />
      <ImplementationFaq isFr={isFr} />

      {/* COUVERTURE NATIONALE (Sprint 14.9 levier 3 — pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'implémentation IA"
        serviceLabelEn="AI implementation"
        serviceSlug="implementation"
        tone="paper"
      />

      {/* FAQ GÉOLOCALISÉE (Sprint 14.9 levier 4 — pSEO) */}
      <LocalGeoFaqSection isFr={isFr} service="implementation" tone="sand" />

      {/* CLOSING ILLUSTRATION — Sprint Visual Rhythm 2026 */}
      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="IMPL-03-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/implementation-closing.avif"
            caption={
              isFr
                ? "Implémentation livrée — système opérationnel, clés remises"
                : "Implementation delivered — operational system, keys handed over"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'un système opérationnel livré à l'issue d'une implémentation Axion-IA."
                : "Editorial illustration of an operational system delivered at the end of an Axion-IA implementation."
            }
          />
        </Container>
      </Section>

      <ImplementationCtaBlock isFr={isFr} />

      {/* CTA flottant mobile — visible < lg, après scroll passé le hero,
          caché en bas de page (le CTA Block final reprend le relais). */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "Décrire mon besoin · 48 h" : "Describe my need · 48 h"}
        track="impl-sticky-mobile"
      />
    </>
  );
}
