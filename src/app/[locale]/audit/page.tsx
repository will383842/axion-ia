import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { BeyondAuditBlock } from "@/components/sections/AuditConversionBlocks";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { VisibiliteCallout } from "@/components/visibilite/VisibiliteCallout";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { AuditHero } from "@/components/services/audit/AuditHero";
import { AuditWhyAudit } from "@/components/services/audit/AuditWhyAudit";
import { AuditContactBand } from "@/components/services/audit/AuditContactBand";
import { AuditAudience } from "@/components/services/audit/AuditAudience";
import { AuditWhyChooseUs } from "@/components/services/audit/AuditWhyChooseUs";
import { AuditRealisations } from "@/components/services/audit/AuditRealisations";
import { ServiceReviewsSection } from "@/components/reviews/ServiceReviewsSection";
import { AuditBenefits } from "@/components/services/audit/AuditBenefits";
import { AuditProcessFlow } from "@/components/services/audit/AuditProcessFlow";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { AuditTrustPills } from "@/components/services/audit/AuditTrustPills";
import { AuditFaq } from "@/components/services/audit/AuditFaq";
import { AuditWhyNow } from "@/components/services/audit/AuditWhyNow";
import { AuditCtaBlock } from "@/components/services/audit/AuditCtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { AUDIT_TIERS_META, auditTierPath } from "@/content/audit-taxonomy";
import { SERVICE_BY_ID, serviceOfficial } from "@/content/services";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  buildCollectionPageJsonLd,
  buildHowToJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { ServiceJourneyBand } from "@/components/services/ServiceJourneyBand";

// ============================================================================
// Hub /audit — refonte 2026-05-31 (Will), best practices 2026 alignées sur
// /interventions/collectives et /un-a-un : hero value-first (sans prix), 2
// cartes formats (Flash priced / Audit complet sur devis), bande « pourquoi
// maintenant », sections allégées et dé-verbosées. CTAs partout : Réserver un
// appel / Nous écrire. JSON-LD Service/ItemList/HowTo/Image conservés.
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  const titleStr =
    loc === "fr"
      ? "Audit IA en entreprise · plan d'action chiffré · Axion-IA"
      : "Enterprise AI audit · costed action plan · Axion-IA";
  return {
    ...(await buildProductMetadata({
      locale,
      path: "/audit",
      title: titleStr,
      description:
        loc === "fr"
          ? "Audit IA : cartographie complète de votre entreprise, identification des priorités et rapport chiffré sous 7 jours. Premiers gains visibles en quelques jours. Partout en France."
          : "Enterprise AI audit across France: we map where AI saves you time and money, and you leave with a costed, prioritised action plan.",
    })),
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
      ? "L'audit IA en entreprise rigoureux, complet et minutieux — la référence française. 4 niveaux selon la taille (PME, ETI, grande entreprise). Cartographie détaillée, ROI chiffré, feuille de route actionnable. Partout en France."
      : "The rigorous, complete and meticulous enterprise AI audit — the French benchmark. 4 levels by company size (small business, SME, mid-cap, large enterprise). Detailed mapping, quantified ROI, actionable roadmap. Across France.",
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
          ? "On vous recommande le niveau d'audit IA optimal selon votre taille : Audit sur place (1 jour), Ciblé, Stratégique PME ou Stratégique ETI. Devis transparent à partir de 24-48 h ouvrées selon la complexité."
          : "We recommend the optimal AI audit tier based on your size: On-site audit (small business), Targeted (SME), Strategic SME or Strategic mid-cap. Transparent quote from 24-48 business hours depending on complexity.",
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
  // Migré vers le manifeste SSOT `PAGE_IMAGES_MANIFEST["/audit"]` (2026-07-01) :
  // le même manifeste alimente ce JSON-LD ImageObject ET le sitemap images.
  const auditImagesJsonLd = buildPageImageGraphJsonLd({ locale: loc, path: "/audit" });

  // CollectionPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  // /audit est un hub 4 niveaux → CollectionPage.
  const auditPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/audit",
    name: isFr ? "Audit IA en entreprise · Axion-IA" : "Enterprise AI audit · Axion-IA",
    description: isFr
      ? "Audit IA en entreprise partout en France : on cartographie où l'IA vous fait gagner du temps et de l'argent, et vous repartez avec un plan d'action chiffré et priorisé."
      : "Enterprise AI audit across France: we map where AI saves you time and money, and you leave with a costed, prioritised action plan.",
    speakable: true,
    ...(buildPrimaryImageOfPage("/audit")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/audit") } }
      : {}),
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

  const breadcrumbItems = [{ href: "/audit", label: serviceOfficial(SERVICE_BY_ID.audit, isFr) }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* Ordre des sections (Will 2026-05-31) — narration value-first. Sans
          numéros : l'ordre est porté par la séquence JSX (réordonnable sans
          renumérotation). */}

      {/* HERO value-first — sans prix (best practice 2026) */}
      <AuditHero isFr={isFr} />

      {/* PREUVE SOCIALE — bandeau logos clients défilant, juste après le hero
          (Will 2026-05-31). */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* POSITIONNEMENT — bandeau « parcours » commun aux 5 hubs (audit
          positionnement 2026-07-28). Placé APRÈS le hero pour ne pas
          déplacer l'élément LCP. */}
      <ServiceJourneyBand currentId="audit" isFr={isFr} />

      {/* POURQUOI UN AUDIT — « L'IA, tout le monde en parle. Nous, on la rend
          rentable. » Contraste visuel (foncer ❌ vs méthode Axion-IA ✅) +
          posture spécialiste de toute la chaîne IA. */}
      <AuditWhyAudit isFr={isFr} />

      {/* MÉTHODOLOGIE — accroche compacte + visuel 8 étapes + CTA popup
          (Will 2026-05-31). */}
      <AuditProcessFlow isFr={isFr} />

      {/* BANDEAU TERRACOTTA CONTACT — orientation vers le bon niveau d'audit
          (adapté du bandeau /un-a-un). */}
      <AuditContactBand isFr={isFr} />

      {/* CE QU'UN AUDIT IA VOUS APPORTE — 5 bénéfices concrets + CTA popup « tout
          ce que l'IA peut apporter » (champ des possibles par fonction). Remonté
          avant la section audience (Will 2026-05-31). */}
      <AuditBenefits isFr={isFr} />

      {/* À QUI ÇA S'ADRESSE — cards par taille (PME, ETI, grande
          entreprise). */}
      <AuditAudience isFr={isFr} />

      {/* POURQUOI NOUS CHOISIR — posture premium : toute la chaîne IA de bout en
          bout (formation → implémentation), vrai code source vs rafistolage,
          architectes seniors, de l'audit au cadrage des agents (Will 2026-05-31). */}
      <AuditWhyChooseUs isFr={isFr} />

      {/* RÉALISATIONS — 8 projets diversifiés (PME/ETI/grands groupes) en marquee défilant,
          non cliquables, juste après le pitch « toute la chaîne IA » (Will
          2026-05-31). Aucun nom de société/marque : secteur + résultat mesurable. */}
      <AuditRealisations isFr={isFr} />

      {/* BANDEAU CONTACT — après les réalisations, conversion « Réserver un appel /
          Nous écrire » (calqué bandeau bas de home, Will 2026-05-31). */}
      <AuditContactBand isFr={isFr} />

      {/* AVIS CLIENTS — preuve sociale (5 étoiles + avatar), réaliste sans
          inventer de marque (prénom + initiale + fonction). (Will 2026-05-31) */}
      <ServiceReviewsSection serviceLine="audits" />

      {/* Barre de réassurance (confidentialité/NDA, RGPD, AI Act, pure-play) */}
      <AuditTrustPills isFr={isFr} />

      {/* POURQUOI MAINTENANT — « Le bon moment, c'est maintenant » (brief §10) */}
      <AuditWhyNow isFr={isFr} />

      {/* COUVERTURE NATIONALE — « L'audit IA disponible partout en France » (pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'audit IA"
        serviceLabelEn="AI audit"
        serviceSlug="audit"
        tone="sand"
      />

      {/* FAQ (unique) */}
      <AuditFaq isFr={isFr} />

      {/* PONT AUDIT → IMPLÉMENTATION (upsell, sans engagement) */}
      <BeyondAuditBlock isFr={isFr} />

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="audit" />

      {/* CTA FINAL bifurqué — Réserver un appel / Nous écrire */}
      <VisibiliteCallout isFr={isFr} />

      <AuditCtaBlock isFr={isFr} />

      {/* STICKY CTA MOBILE */}
      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track="audit-sticky-call"
        threshold={500}
      />

      {/* V-04 P1 (Sprint Correctif suite 2026-05-22) — Service inline (SEO racine
          critique), ItemList déféré afterInteractive (-100 à -200 ms TBT). */}
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={auditPageJsonLd} />
      <JsonLd data={itemListJsonLd} strategy="afterInteractive" scriptId="jsonld-audit-itemlist" />
      {auditImagesJsonLd ? <JsonLd data={auditImagesJsonLd} /> : null}
      <JsonLd data={auditHowToJsonLd} />
    </>
  );
}
