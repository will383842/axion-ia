import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Illustration } from "@/components/visual/Illustration";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { InterventionsHero } from "@/components/services/interventions/InterventionsHero";
import { InterventionsAudienceStrip } from "@/components/services/interventions/InterventionsAudienceStrip";
import { InterventionsFamiliesGrid } from "@/components/services/interventions/InterventionsFamiliesGrid";
import { InterventionsReservationFlow } from "@/components/services/interventions/InterventionsReservationFlow";
import { InterventionsMaturityLevels } from "@/components/services/interventions/InterventionsMaturityLevels";
import { InterventionsCrossModules } from "@/components/services/interventions/InterventionsCrossModules";
import { InterventionsFaq } from "@/components/services/interventions/InterventionsFaq";
import { INTERVENTION_TIERS, formatAmount, getEntryPriceEur, getTierById } from "@/content/pricing";
import { FAMILIES, familyPath } from "@/content/interventions-taxonomy";
import { buildProductMetadata, buildServiceJsonLd, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

// ISR 1 h — page hub canonique (data statique pricing + taxonomie). Aligné sur
// les autres hubs services (/audit, /implementation, /sites-web-augmentes).
export const revalidate = 3600;

// ============================================================================
// Sprint A Phase 3 (2026-05-25) — Refactor : page hub /interventions assemble
// désormais les composants `src/components/services/interventions/*` extraits
// en Phase 2. La taxonomie (3 BLOCS FAMILLE issus du Sprint 14.10.7) et toute
// la grammaire visuelle sont préservées intégralement à l'intérieur des
// composants. Cette page se contente d'orchestrer :
//   - `generateMetadata` (pattern actuel)
//   - Breadcrumbs hub
//   - 7 composants Phase 2 (sans `villeContext` — page hub canonique)
//   - Wrappers transverses : LocalCoverage / LocalGeoFaq / Illustration closing
//   - CtaBlock final + StickyMobileCta
//   - JSON-LD Service (avec hasOfferCatalog) + ItemList (4 familles)
//
// Les pages ville (`/[locale]/implantations/{region}/{ville}/interventions`)
// réutiliseront les mêmes composants en leur passant `villeContext`.
// ============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const essentielle = getTierById(INTERVENTION_TIERS, "intervention-essentielle");
  const essentiellePrice = formatAmount(essentielle.priceFlat!, loc);
  return buildProductMetadata({
    locale,
    path: "/interventions",
    title:
      loc === "fr"
        ? "Interventions IA en entreprise · 4 familles · France & international"
        : "Corporate AI sessions · 4 families · France & international",
    description:
      loc === "fr"
        ? `Interventions et formations IA opérationnelles sur site organisées en 4 blocs : formations équipe (4 h à 3 j+, à partir de ${essentiellePrice}), coaching individuel 1-to-1, journée stratégique dirigeants, et conférence plénière. France et international.`
        : `Operational AI sessions on site organised in 4 blocks: team trainings (4 h to 3 d+, from ${essentiellePrice}), 1-on-1 coaching, executive strategic day, and plenary talk. France and international.`,
  });
}

export default async function InterventionsListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const essentielleEntry = formatAmount(
    getTierById(INTERVENTION_TIERS, "intervention-essentielle").priceFlat!,
    loc,
  );

  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions en entreprise" : "Corporate AI sessions",
    },
  ];

  // JSON-LD Service principal — pointe vers le hub et liste les 4 familles
  // via le ItemList plus bas.
  const serviceJsonLd = {
    ...buildServiceJsonLd({
      locale: loc,
      path: "/interventions",
      name: isFr
        ? "Interventions IA en entreprise · 4 familles · Axion-IA"
        : "Corporate AI sessions · 4 families · Axion-IA",
      description: isFr
        ? `Catalogue d'interventions et formations IA opérationnelles sur site, organisé en 4 familles : formations équipe (4 paliers durée de 4 h à 3 j+, à partir de ${essentielleEntry}), coaching individuel 1-to-1, journée stratégique dirigeants, et conférence plénière. France et international.`
        : `Catalogue of operational AI sessions on site, organised in 4 families: team trainings (4 duration tiers from 4 h to 3 d+, from ${essentielleEntry}), 1-on-1 coaching, executive strategic day, and plenary talk. France and international.`,
      serviceType: "AI training & engagement",
      priceEur: getEntryPriceEur(INTERVENTION_TIERS) ?? 0,
      areasServed: buildServiceAreasServed(loc),
    }),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: isFr ? "Familles d'interventions IA · Axion-IA" : "AI session families · Axion-IA",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Interventions collectives" : "Team sessions",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Coaching individuel" : "Individual coaching",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Interventions dirigeants" : "Executive sessions",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Conférences IA" : "AI talks",
          },
        },
      ],
    },
  };

  // ItemList JSON-LD — 4 familles (Collectives / Individuel / Dirigeants /
  // Conférence). Le détail des formats reste exposé par chaque page famille /
  // page durée via leur propre JSON-LD.
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/interventions",
    name: isFr ? "Familles d'interventions IA" : "AI session families",
    items: FAMILIES.map((family, idx) => ({
      position: idx + 1,
      name: isFr ? family.labelFr : family.labelEn,
      url: `${SITE_URL}/${locale}${familyPath(family, loc)}`,
      description: isFr ? family.taglineFr : family.taglineEn,
    })),
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <InterventionsHero isFr={isFr} />

      <InterventionsAudienceStrip isFr={isFr} />

      <InterventionsFamiliesGrid isFr={isFr} />

      <InterventionsReservationFlow isFr={isFr} />

      <InterventionsMaturityLevels isFr={isFr} />

      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Les interventions IA"
        serviceLabelEn="AI sessions"
        serviceSlug="interventions"
        tone="paper"
      />

      <LocalGeoFaqSection isFr={isFr} service="interventions" tone="sand" />

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="INTERV-02-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/interventions-closing.avif"
            caption={
              isFr
                ? "Équipe en mouvement — silhouettes éditoriales orientées vers l'action"
                : "Team in motion — editorial silhouettes oriented toward action"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'une équipe orientée vers l'action après une intervention Axion-IA."
                : "Editorial illustration of a team oriented toward action after an Axion-IA session."
            }
          />
        </Container>
      </Section>

      <InterventionsCrossModules isFr={isFr} />

      <InterventionsFaq isFr={isFr} />

      <CtaBlock
        eyebrow={isFr ? "Démarrer concrètement" : "Start concretely"}
        title={
          isFr
            ? "Pré-réservez la prochaine intervention disponible"
            : "Pre-book the next available session"
        }
        description={
          isFr
            ? "Calendrier maison en temps réel. Réponse sous 48 h ouvrées sur les devis. France et international — toutes les entreprises sont les bienvenues."
            : "Live in-house calendar. 48-business-hour reply on quotes. France and international — every company is welcome."
        }
        cta={
          <Cta
            href="/reserver"
            size="lg"
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep shadow-[0_8px_24px_-8px_rgba(205,107,72,0.6)]"
          >
            {isFr ? "Pré-réservez sur le calendrier" : "Pre-book on the calendar"} →
          </Cta>
        }
        tone="dark"
      />

      {/* P1-17 audit E2E NAV+CTA 2026-05-15 — sticky mobile CTA pour hubs
          services tier-1 (parité /audit et /implementation). Pousse vers le
          format entry (4 h) qui correspond au prix d'entrée pricing.ts. */}
      <StickyMobileCta
        href="/reserver"
        label={
          isFr
            ? `Réserver · à partir de ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "fr", { compact: true })}`
            : `Book · from ${formatAmount(getEntryPriceEur(INTERVENTION_TIERS) ?? 0, "en", { compact: true })}`
        }
        track="interventions-hub-sticky"
        threshold={500}
      />

      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} />
    </>
  );
}
