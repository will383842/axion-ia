import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  WhyAxionIA,
  SignatureCard,
  BeyondAuditBlock,
} from "@/components/sections/AuditConversionBlocks";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { AuditHero } from "@/components/services/audit/AuditHero";
import { AuditValueProp } from "@/components/services/audit/AuditValueProp";
import { AuditWhyAudit } from "@/components/services/audit/AuditWhyAudit";
import { AuditContactBand } from "@/components/services/audit/AuditContactBand";
import { AuditProcessFlow } from "@/components/services/audit/AuditProcessFlow";
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { AuditTrustPills } from "@/components/services/audit/AuditTrustPills";
import { AuditFormatsCards } from "@/components/services/audit/AuditFormatsCards";
import { AuditFaq } from "@/components/services/audit/AuditFaq";
import { AuditMaturityLevels } from "@/components/services/audit/AuditMaturityLevels";
import { AuditCapabilitiesMap } from "@/components/services/audit/AuditCapabilitiesMap";
import { AuditWhyNow } from "@/components/services/audit/AuditWhyNow";
import { AuditDeliverable } from "@/components/services/audit/AuditDeliverable";
import { AuditCtaBlock } from "@/components/services/audit/AuditCtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { AUDIT_TIERS_META, auditTierPath } from "@/content/audit-taxonomy";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildImageGraphJsonLd,
  buildHowToJsonLd,
  SITE_URL,
} from "@/lib/seo";

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
      ? "Audit IA en entreprise · cartographie & plan d'action chiffré · Axion-IA"
      : "Enterprise AI audit · mapping & costed action plan · Axion-IA";
  return {
    ...buildProductMetadata({
      locale,
      path: "/audit",
      title: titleStr,
      description:
        loc === "fr"
          ? "Le diagnostic qui fait passer votre entreprise à l'IA : on cartographie partout où l'IA vous fait gagner du temps et de l'argent, et vous repartez avec un plan d'action chiffré et priorisé. Audit Flash 1 journée pour TPE et petites PME ; sur devis pour PME, ETI et grande entreprise."
          : "The diagnosis that moves your company to AI: we map everywhere AI saves you time and money, and you leave with a costed, prioritised action plan. 1-day Flash audit for small businesses and small SMEs; on quote for SME, mid-cap and large enterprise.",
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
      {
        src: "/illustrations/methodologie-audit-ia-8-etapes-v4.webp",
        name: isFr
          ? "Méthodologie d'audit IA Axion-IA en 8 étapes"
          : "Axion-IA AI audit methodology in 8 steps",
        alt: isFr
          ? "Méthodologie d'audit IA Axion-IA en 8 étapes illustrées : cadrage, entretiens métier, consolidation et analyse, filtrage des options, évaluation et recommandations chiffrées (ROI), restitution et feuille de route, mise en œuvre, adoption et pilotage dans la durée — chaque étape avec son livrable."
          : "Axion-IA AI audit methodology in 8 illustrated steps: scoping, business interviews, consolidation and analysis, option filtering, evaluation and costed recommendations (ROI), read-out and roadmap, implementation, adoption and long-term steering — each step with its deliverable.",
        width: 1975,
        height: 569,
        encodingFormat: "image/webp",
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

      {/* Ordre des sections (Will 2026-05-31) — narration value-first. Sans
          numéros : l'ordre est porté par la séquence JSX (réordonnable sans
          renumérotation). */}

      {/* HERO value-first — sans prix (best practice 2026) */}
      <AuditHero isFr={isFr} />

      {/* PREUVE SOCIALE — bandeau logos clients défilant, juste après le hero
          (Will 2026-05-31). */}
      <ClientLogosMarqueeBand isFr={isFr} />

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

      {/* PROMESSE — bloc value-prop « Faites auditer votre entreprise et révélez
          tout ce que l'IA peut réellement vous apporter. » */}
      <AuditValueProp isFr={isFr} />

      {/* Barre de réassurance (confidentialité/NDA, RGPD, AI Act, pure-play) */}
      <AuditTrustPills isFr={isFr} />

      {/* POURQUOI MAINTENANT — « Le bon moment, c'est maintenant » (brief §10) */}
      <AuditWhyNow isFr={isFr} />

      {/* LE LIVRABLE — « Vous repartez avec un plan, pas une discussion » (brief §8) */}
      <AuditDeliverable isFr={isFr} />

      {/* TOUT CE QUE L'IA PEUT APPORTER — carte exhaustive par fonction (brief §2).
          Le prospect s'y reconnaît en 5 s ; l'audit détermine ce qui s'applique à lui. */}
      <AuditCapabilitiesMap isFr={isFr} />

      {/* QUEL NIVEAU POUR VOUS — « De zéro IA à équipes IA-fluentes » (anti-fear) */}
      <AuditMaturityLevels isFr={isFr} />

      {/* POURQUOI AXION-IA — « 5 raisons concrètes de nous choisir » */}
      <WhyAxionIA isFr={isFr} />

      {/* LES FORMATS — 2 cartes (Flash priced / Audit complet sur devis). L'offre
          apparaît dès que le prospect est convaincu, après les raisons. */}
      <AuditFormatsCards isFr={isFr} />

      {/* COUVERTURE NATIONALE — « L'audit IA disponible partout en France » (pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'audit IA"
        serviceLabelEn="AI audit"
        serviceSlug="audit"
        tone="sand"
      />

      {/* SIGNATURE FONDATEUR (légitimité humaine) */}
      <SignatureCard isFr={isFr} />

      {/* FAQ (unique) */}
      <AuditFaq isFr={isFr} />

      {/* PONT AUDIT → IMPLÉMENTATION (upsell, sans engagement) */}
      <BeyondAuditBlock isFr={isFr} />

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="audit" />

      {/* CTA FINAL bifurqué — Réserver un appel / Nous écrire */}
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
      <JsonLd data={itemListJsonLd} strategy="afterInteractive" scriptId="jsonld-audit-itemlist" />
      <JsonLd data={auditImagesJsonLd} />
      <JsonLd data={auditHowToJsonLd} />
    </>
  );
}
