/**
 * /[locale]/implementation — Page hub Implémentation IA (Module 3).
 *
 * Refonte 2026-06-02 (Will) — narration value-first alignée sur /audit et
 * /un-a-un, SANS prix : hero → nos services (4 piliers) → nos expertises (popup)
 * → bandeau contact → méthodologie → pourquoi nous → projets réalisés → avis →
 * couverture France → FAQ → bandeau contact final. Composants centralisés
 * réutilisés ; les anciennes sections orientées tarifs/comparatif/scénarios ont
 * été supprimées.
 *
 * La page hub n'injecte PAS de `villeContext` (pages ville = template dédié).
 * Aucun montant : prix retirés de la metadata, du Service JSON-LD et du HowTo.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildImageGraphJsonLd,
  buildHowToJsonLd,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { ImplementationHero } from "@/components/services/implementation/ImplementationHero";
import { ImplementationServices } from "@/components/services/implementation/ImplementationServices";
import { ImplementationExpertises } from "@/components/services/implementation/ImplementationExpertises";
import { ImplementationContactBand } from "@/components/services/implementation/ImplementationContactBand";
import { ImplementationMethodology } from "@/components/services/implementation/ImplementationMethodology";
import { ImplementationWhyChooseUs } from "@/components/services/implementation/ImplementationWhyChooseUs";
import { ImplementationFounderBand } from "@/components/services/implementation/ImplementationFounderBand";
import { ImplementationRealisations } from "@/components/services/implementation/ImplementationRealisations";
import { ImplementationClientReviews } from "@/components/services/implementation/ImplementationClientReviews";
import { ImplementationFaq } from "@/components/services/implementation/ImplementationFaq";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const loc: "fr" | "en" = locale === "fr" ? "fr" : "en";
  return buildProductMetadata({
    locale,
    path: "/implementation",
    title:
      loc === "fr"
        ? "Implémentation IA & agents IA sur-mesure · Axion-IA"
        : "Custom AI implementation & AI agents · Axion-IA",
    description:
      loc === "fr"
        ? "Implémentation IA opérationnelle : agents IA, chatbots, automatisations et intégrations sur-mesure, branchés sur vos outils (CRM, ERP). Du vrai code, à vous, sans abonnement. Partout en France."
        : "Operational AI implementation: AI agents, chatbots, automations and custom integrations, wired into your tools (CRM, ERP). Real code, yours, no subscription. Across France.",
  });
}

export default async function ImplementationListing({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    {
      href: "/implementation",
      label: isFr ? "Implémentation IA" : "AI implementation",
    },
  ];

  // Service JSON-LD avec areasServed multi-régions + hasOfferCatalog (9 offres).
  // Sans `priceEur` (cf. /audit Sprint 14.10.8 : éviter l'interprétation
  // « service gratuit »). Description sans montant.
  const serviceJsonLd = {
    ...buildServiceJsonLd({
      locale: loc,
      path: "/implementation",
      name: isFr
        ? "Implémentation IA opérationnelle & agents IA · Axion-IA"
        : "Operational AI implementation & AI agents · Axion-IA",
      description: isFr
        ? "Implémentation IA opérationnelle sur-mesure : agents IA conversationnels, chatbots, automatisation des processus, intégration CRM/ERP, traitement de documents et IA custom. Du code livré, à vous, sans abonnement. Partout en France."
        : "Custom operational AI implementation: conversational AI agents, chatbots, process automation, CRM/ERP integration, document processing and custom AI. Code delivered, yours, no subscription. Across France.",
      serviceType: "AI implementation",
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
          itemOffered: { "@type": "Service", name: isFr ? "Agents IA" : "AI Agents" },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Chatbots & assistants" : "Chatbots & assistants",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Automatisation des processus" : "Process automation",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Intégrations CRM / ERP" : "CRM / ERP integrations",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Traitement de documents" : "Document processing",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Recherche interne (RAG)" : "Internal search (RAG)",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: isFr ? "Génération de contenu" : "Content generation",
          },
        },
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: isFr ? "IA Custom" : "Custom AI" },
        },
      ],
    },
  };

  // HowTo JSON-LD — process d'implémentation IA en 3 étapes (AEO). Sans prix.
  const implementationHowToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/implementation",
    name: isFr
      ? "Comment déployer une implémentation IA opérationnelle"
      : "How to deploy an operational AI implementation",
    description: isFr
      ? "3 étapes pour cadrer, construire et mettre en production une solution IA sur-mesure avec Axion-IA — agents IA, chatbots, automatisations métier, intégrations CRM/ERP."
      : "3 steps to scope, build and deploy a custom AI solution with Axion-IA — AI agents, chatbots, business automations, CRM/ERP integrations.",
    steps: [
      {
        name: isFr ? "Cadrage du besoin" : "Need scoping",
        text: isFr
          ? "Atelier de cadrage pour identifier le cas prioritaire selon votre métier (agent connecté à vos outils, chatbot, automatisation back-office, RAG, etc.). Architecture, backlog priorisé et spécifications claires."
          : "Scoping workshop to identify the priority case for your business (agent wired to your tools, chatbot, back-office automation, RAG, etc.). Architecture, prioritised backlog and clear specs.",
      },
      {
        name: isFr ? "Développement itératif" : "Iterative development",
        text: isFr
          ? "Construction par sprints courts avec démos régulières et validation métier à chaque étape. Vous voyez la solution prendre forme sur vos vraies données, sans effet tunnel."
          : "Build in short sprints with regular demos and business validation at each step. You watch the solution take shape on your real data, with no tunnel effect.",
      },
      {
        name: isFr ? "Mise en production et suivi" : "Go-live and follow-up",
        text: isFr
          ? "Recette, mise en production sur vos outils, monitoring et formation des équipes. Le code et la documentation vous sont livrés ; vous faites évoluer à la demande, sans abonnement imposé."
          : "QA, go-live on your tools, monitoring and team training. Code and docs are delivered to you; you evolve on demand, with no imposed subscription.",
      },
    ],
  });

  // ImageObject @graph — signal AEO Google Images + AI Overviews (sans prix).
  // Synchronisé sur les 2 images RÉELLEMENT affichées sur la page (visuel des
  // 4 piliers + portrait du fondateur), métadonnées exactes (dimensions /
  // format / alt identiques au rendu).
  const implementationImagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/implementation-piliers-axion-ia.webp",
        name: isFr
          ? "Les 4 piliers de l'implémentation IA Axion-IA"
          : "The 4 pillars of Axion-IA AI implementation",
        alt: isFr
          ? "Les 4 piliers de l'implémentation IA Axion-IA : Implémentation (de la stratégie à la réalité), Agents IA (vos collaborateurs intelligents), Intégration native (dans votre écosystème) et Performance (mesurable, durable, réelle)."
          : "The 4 pillars of Axion-IA AI implementation: Implementation (from strategy to reality), AI agents (your intelligent coworkers), Native integration (into your ecosystem) and Performance (measurable, lasting, real).",
        width: 1600,
        height: 484,
        encodingFormat: "image/webp",
      },
      {
        src: "/illustrations/william-fondateur-axion-ia.webp",
        name: isFr ? "William — Fondateur & CEO Axion-IA" : "William — Founder & CEO Axion-IA",
        alt: isFr
          ? "Portrait de William, fondateur et CEO d'Axion-IA — pilote les implémentations IA (agents IA, automatisations, RAG, intégrations CRM/ERP) avec une exigence technique et une relation directe et humaine."
          : "Portrait of William, Axion-IA founder and CEO — drives AI implementations (AI agents, automations, RAG, CRM/ERP integrations) with technical rigour and a direct, human relationship.",
        width: 1000,
        height: 1000,
        encodingFormat: "image/webp",
      },
    ],
  });

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={implementationImagesJsonLd} />
      <JsonLd data={implementationHowToJsonLd} />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO value-first (sans prix) */}
      <ImplementationHero isFr={isFr} />

      {/* NOS SERVICES — positionnement + 4 piliers natifs */}
      <ImplementationServices isFr={isFr} />

      {/* NOS EXPERTISES — 6 cartes + popup du champ des possibles */}
      <ImplementationExpertises isFr={isFr} />

      {/* BANDEAU CONTACT (orientation) */}
      <ImplementationContactBand isFr={isFr} trackSuffix="-mid" />

      {/* NOTRE MÉTHODOLOGIE — 4 étapes, sans durée */}
      <ImplementationMethodology isFr={isFr} />

      {/* BANDEAU WILLIAM — état d'esprit & satisfaction (adapté de la home) */}
      <ImplementationFounderBand isFr={isFr} />

      {/* POURQUOI TRAVAILLER AVEC NOUS — 4 raisons (cartes statiques) */}
      <ImplementationWhyChooseUs isFr={isFr} />

      {/* PROJETS RÉALISÉS — marquee (illustratif) */}
      <ImplementationRealisations isFr={isFr} />

      {/* AVIS CLIENTS */}
      <ImplementationClientReviews isFr={isFr} />

      {/* L'IMPLÉMENTATION & AGENTS IA PARTOUT EN FRANCE (pSEO levier 3) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'implémentation IA"
        serviceLabelEn="AI implementation"
        serviceSlug="implementation"
        tone="paper"
      />

      {/* FAQ unique (sans prix) — la FAQ géolocalisée a été retirée pour ne pas
          faire « deux FAQ » à la suite ; la couverture locale reste portée par
          LocalCoverageSection + les pages ville /implantations. */}
      <ImplementationFaq isFr={isFr} />

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="implementation" />

      {/* BANDEAU CONTACT FINAL */}
      <ImplementationContactBand isFr={isFr} trackSuffix="-final" />

      {/* CTA flottant mobile — visible < lg */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "Décrire mon besoin" : "Describe my need"}
        track="impl-sticky-mobile"
      />
    </>
  );
}
