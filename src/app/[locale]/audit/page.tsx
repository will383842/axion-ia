import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { AuditHubToggle } from "@/components/sections/AuditHubToggle";
import {
  TrustBadges,
  WhyAxionIA,
  SocialProof,
  SignatureCard,
  BeyondAuditBlock,
} from "@/components/sections/AuditConversionBlocks";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { AuditHero } from "@/components/services/audit/AuditHero";
import { AuditTrustPills } from "@/components/services/audit/AuditTrustPills";
import { AuditTierGrid } from "@/components/services/audit/AuditTierGrid";
import { AuditFaq } from "@/components/services/audit/AuditFaq";
import { AuditMaturityLevels } from "@/components/services/audit/AuditMaturityLevels";
import { AuditCrossModules } from "@/components/services/audit/AuditCrossModules";
import { AuditMethodology } from "@/components/services/audit/AuditMethodology";
import { AuditCtaBlock } from "@/components/services/audit/AuditCtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { AUDIT_TIERS, formatAmount, formatAmountRange, getTierById } from "@/content/pricing";
import { AUDIT_BY_SIZE, AUDIT_TIERS_META, auditTierPath } from "@/content/audit-taxonomy";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildImageGraphJsonLd,
  buildHowToJsonLd,
  SITE_URL,
} from "@/lib/seo";

// ============================================================================
// Sprint A · Phase 3 Refactor-1 (Will 2026-05-25) — page hub /audit reconstruite
// en assemblage des composants Phase 2 sous `src/components/services/audit/`.
// La logique métier (textes, JSON-LD locaux, CTAs) vit désormais dans les
// composants ; cette page ne fait que de l'orchestration + Service/ItemList
// JSON-LD globaux + Breadcrumbs + StickyMobileCta + sections wrappers SSOT
// existantes (AuditHubToggle, TrustBadges, WhyAxionIA, SignatureCard,
// SocialProof, BeyondAuditBlock, LocalCoverageSection, LocalGeoFaqSection).
//
// Sprint 14.10.8 (Will 2026-05-12) — refonte hub /audit en 2 axes toggle.
// Pattern miroir de /interventions.
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

const TIGHT_X = "lg:px-6 xl:px-10";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const flashTier = getTierById(AUDIT_TIERS, "audit-flash");
  const cibleTier = getTierById(AUDIT_TIERS, "audit-cible");
  const pmeTier = getTierById(AUDIT_TIERS, "audit-strategique-pme");
  const etiTier = getTierById(AUDIT_TIERS, "audit-strategique-eti");
  const flash = formatAmount(flashTier.priceFlat!, loc, { compact: true });
  const cibleRange = formatAmountRange(cibleTier.priceMin!, cibleTier.priceMax!, loc, {
    compact: true,
  });
  const pmeRange = formatAmountRange(pmeTier.priceMin!, pmeTier.priceMax!, loc, { compact: true });
  const etiFrom = formatAmount(etiTier.priceMin!, loc, { compact: true });
  const titleStr =
    loc === "fr"
      ? `Audit IA PME & ETI · 4 niveaux · Flash dès ${flash} · Axion-IA`
      : `AI audit for SMEs & mid-caps · 4 levels · from ${flash} · Axion-IA`;
  return {
    ...buildProductMetadata({
      locale,
      path: "/audit",
      title: titleStr,
      description:
        loc === "fr"
          ? `4 niveaux d'audit IA : Flash ${flash}, Audit ciblé ${cibleRange}, Stratégique PME ${pmeRange}, Stratégique ETI à partir de ${etiFrom}. Choisissez selon votre taille ou votre situation.`
          : `4-level AI audit: Flash ${flash}, Targeted ${cibleRange}, Strategic SMB ${pmeRange}, Strategic mid-cap from ${etiFrom}. Choose by size or by situation.`,
    }),
    title: { absolute: titleStr },
  };
}

export default async function AuditHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // JSON-LD Service global pour le hub /audit (factory centralisée).
  // Sprint 14.10.8 : retrait `priceEur: 0` qui pouvait être interprété par
  // Google comme « service gratuit ». Le prix d'entrée 490 € est exposé sur
  // les pages détail tier (où il est contextualisé).
  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr ? "Audit IA en entreprise · Axion-IA" : "Enterprise AI audit · Axion-IA",
    description: isFr
      ? "4 niveaux d'audit IA selon la taille de l'entreprise et la situation. France & international."
      : "4 AI audit levels by company size and situation. France & international.",
    serviceType: "AI audit",
  });

  // HowTo JSON-LD — Sprint AEO Phase 3 2026-05-28 (Will). Process en 3
  // étapes pour réserver et dérouler un audit IA Axion-IA. Permet citation
  // par Perplexity / Claude.ai / Google AI Overviews sur requêtes « comment
  // faire un audit IA », « comment se passe un audit IA ».
  const auditHowToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr ? "Comment réserver un audit IA Axion-IA" : "How to book an Axion-IA AI audit",
    description: isFr
      ? "3 étapes pour cadrer et organiser votre audit IA stratégique avec Axion-IA — du premier contact à la restitution finale avec roadmap 6-12 mois."
      : "3 steps to scope and run your strategic AI audit with Axion-IA — from first contact to final read-out with 6-12 month roadmap.",
    steps: [
      {
        name: isFr ? "Décrivez votre contexte" : "Describe your context",
        text: isFr
          ? "Formulaire en ligne, appel téléphonique ou échange direct. Nous explorons votre effectif, votre secteur, votre maturité IA actuelle et vos objectifs business."
          : "Online form, phone call or direct chat. We explore your headcount, sector, current AI maturity and business objectives.",
      },
      {
        name: isFr ? "Niveau d'audit calibré" : "Calibrated audit tier",
        text: isFr
          ? "On vous recommande le niveau d'audit IA optimal selon votre taille : Flash (TPE), Ciblé (PME), Stratégique PME ou Stratégique ETI. Devis transparent sous 48 h ouvrées."
          : "We recommend the optimal AI audit tier based on your size: Flash (small business), Targeted (SME), Strategic SME or Strategic mid-cap. Transparent quote within 48 business hours.",
      },
      {
        name: isFr ? "Kick-off et restitution" : "Kick-off and read-out",
        text: isFr
          ? "Audit conduit sur 2 à 6 semaines selon le niveau choisi. Restitution finale avec cartographie IA, ROI chiffré par cas d'usage prioritaire, et roadmap 6-12 mois d'implémentation."
          : "Audit conducted over 2 to 6 weeks depending on chosen tier. Final read-out with AI mapping, quantified ROI per priority use case, and 6-12 month implementation roadmap.",
      },
    ],
  });

  // ImageObject @graph — Sprint perfection AEO 2026-05-28 (Will). Photo
  // équipe + portrait fondateur exposés à Google Images + AI Overviews
  // pour requêtes « audit IA entreprise », « cabinet IA France ».
  const auditImagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — audit IA stratégique pour entreprises"
          : "Axion-IA team — strategic AI audit for companies",
        alt: isFr
          ? "Équipe Axion-IA en session de cadrage audit IA — cabinet IA opérationnel français pour TPE, PME, ETI et grandes entreprises. Audit Flash, Ciblé, Stratégique PME et ETI."
          : "Axion-IA team in AI audit scoping session — French operational AI consultancy for SMEs, mid-caps and large enterprises. Flash, Targeted, Strategic SME and mid-cap audits.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA et auditeur IA"
          : "William — Axion-IA founder and AI auditor",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Réalise personnellement les audits IA stratégiques pour dirigeants TPE, PME, ETI et grandes entreprises françaises — cartographie IA, ROI chiffré, roadmap 6-12 mois."
          : "Portrait of William, Axion-IA founder. Personally conducts strategic AI audits for French SME, mid-cap and large enterprise executives — AI mapping, quantified ROI, 6-12 month roadmap.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });

  // ItemList JSON-LD — 4 tiers d'audit. AEO 2026 : LLMs énumèrent les niveaux
  // d'audit quand quelqu'un demande « quels audits IA propose Axion-IA ? ».
  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr ? "Niveaux d'audit IA Axion-IA" : "Axion-IA AI audit levels",
    items: AUDIT_TIERS_META.map((tier, idx) => ({
      position: idx + 1,
      name: isFr ? tier.labelFr : tier.labelEn,
      url: `${SITE_URL}/${loc}${auditTierPath(tier, loc)}`,
      description: isFr ? tier.taglineFr : tier.taglineEn,
    })),
  });

  const breadcrumbItems = [{ href: "/audit", label: isFr ? "Audit IA" : "AI audit" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2 colonnes — Phase 2 SSOT (Sprint A) */}
      <AuditHero isFr={isFr} />

      {/* Trust pills sous le hero — Phase 2 SSOT */}
      <AuditTrustPills isFr={isFr} />

      {/* HUB TOGGLE — 2 axes Par taille / Par situation (wrapper existant) */}
      <Section
        eyebrow={isFr ? "2 portes d'entrée" : "2 entry doors"}
        title={isFr ? "Comment voulez-vous" : "How do you want"}
        titleEm={isFr ? "choisir ?" : "to choose?"}
        contentClassName={TIGHT_X}
      >
        <AuditHubToggle
          locale={loc}
          labels={{
            bySizeTab: isFr ? "Par taille d'entreprise" : "By company size",
            bySituationTab: isFr ? "Par situation" : "By situation",
            bySizeDescription: isFr
              ? `${AUDIT_BY_SIZE.length} segments selon votre effectif INSEE : TPE, PME, ETI, grande entreprise. Chaque segment pointe vers le niveau d'audit le mieux calibré.`
              : `${AUDIT_BY_SIZE.length} segments by your INSEE headcount: small business, SME, mid-cap, enterprise. Each segment points to the best-calibrated audit level.`,
            bySituationDescription: isFr
              ? "4 angles d'entrée selon votre contexte business : urgence, premier audit, approfondissement, gouvernance multi-BU."
              : "4 entry angles by business context: urgent, first audit, deepening, multi-BU governance.",
            learnMore: isFr ? "Voir le format" : "See format",
          }}
        />
      </Section>

      {/* GRILLE 4 TIERS SSOT — Phase 2 (remplace l'ancien rendu inline) */}
      <AuditTierGrid isFr={isFr} />

      {/* TRUST BADGES — Sprint conversion 14.7+ (wrapper existant) */}
      <TrustBadges isFr={isFr} />

      {/* POURQUOI AXIONIA — différenciants vs concurrence */}
      <WhyAxionIA isFr={isFr} />

      {/* SIGNATURE FONDATEUR — légitimité humaine */}
      <SignatureCard isFr={isFr} />

      {/* PREUVE SOCIALE — métriques + secteurs + témoignages */}
      <SocialProof isFr={isFr} />

      {/* FAQ — Phase 2 SSOT (remplace AuditFaqSection legacy) */}
      <AuditFaq isFr={isFr} />

      {/* MATURITÉ IA — 3 cartes anti-fear (Phase 2 SSOT) */}
      <AuditMaturityLevels isFr={isFr} />

      {/* AU-DELÀ DE L'AUDIT — upsell module Implémentation */}
      <BeyondAuditBlock isFr={isFr} />

      {/* CROSS-MODULES Former / Implémenter — Phase 2 SSOT */}
      <AuditCrossModules isFr={isFr} />

      {/* MÉTHODOLOGIE 4 étapes — Phase 2 SSOT */}
      <AuditMethodology isFr={isFr} />

      {/* COUVERTURE NATIONALE (pSEO villes/régions) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'audit IA"
        serviceLabelEn="AI audit"
        serviceSlug="audit"
        tone="paper"
      />

      {/* FAQ GÉOLOCALISÉE (pSEO villes/régions) */}
      <LocalGeoFaqSection isFr={isFr} service="audit" tone="sand" />

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="audit" />

      {/* CTA FINAL Flash terrain — Phase 2 SSOT */}
      <AuditCtaBlock isFr={isFr} />

      {/* STICKY CTA MOBILE */}
      <StickyMobileCta
        href="/reserver?intervention=audit-flash-onsite"
        label={
          isFr
            ? `Flash terrain · ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlatOnsite!, "fr", { compact: true })}`
            : `On-site Flash · ${formatAmount(getTierById(AUDIT_TIERS, "audit-flash").priceFlatOnsite!, "en", { compact: true })}`
        }
        track="audit-flash-onsite-sticky"
        threshold={500}
      />

      {/* V-04 P1 (Sprint Correctif suite 2026-05-22) — Service inline (SEO racine
          critique), ItemList déféré afterInteractive (-100 à -200 ms TBT). */}
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={itemListJsonLd} strategy="afterInteractive" scriptId="jsonld-audit-itemlist" />
      <JsonLd data={auditImagesJsonLd} />
      <JsonLd data={auditHowToJsonLd} />
    </>
  );
}
