/**
 * Hub vertical — Sites web & plateformes SaaS augmentés par l'IA.
 *
 * Sprint A · Phase 3 refactor-5 (Will 2026-05-25) — page assemblée à partir
 * des composants Phase 2 sous `src/components/services/sites-web/`. Le JSON-LD
 * HowTo est émis par `SitesWebMethodology`, le FAQPage par `SitesWebFaq` :
 * la page n'émet plus que `Service` + `ItemList` globaux pour éviter les
 * doublons. Le slug géo `codage-developpement` est volontairement conservé
 * pour `LocalCoverageSection` / `LocalGeoFaqSection` (union de types fermée à
 * 5 valeurs ; `sites-web-augmentes` n'y figure pas — match sémantique le plus
 * proche : codage-developpement, qui partage le même bassin de mots-clés).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import { SitesWebHero } from "@/components/services/sites-web/SitesWebHero";
import { SitesWebTrustPills } from "@/components/services/sites-web/SitesWebTrustPills";
import { SitesWebStackAdaptee } from "@/components/services/sites-web/SitesWebStackAdaptee";
import { SitesWebMethodology } from "@/components/services/sites-web/SitesWebMethodology";
import { SitesWebFaq } from "@/components/services/sites-web/SitesWebFaq";
import { SitesWebCtaBlock } from "@/components/services/sites-web/SitesWebCtaBlock";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildImageGraphJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

// ISR 1 h — page hub canonique (data statique pricing + content). Aligné sur
// les autres hubs services (/audit, /implementation, /interventions).
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/sites-web-augmentes",
    title: isFr
      ? "Sites web & plateformes SaaS augmentés par l'IA · chatbot RAG · search sémantique | Axion-IA"
      : "AI-augmented websites & SaaS platforms · RAG chatbot · semantic search | Axion-IA",
    description: isFr
      ? "Axion-IA intègre l'IA dans vos sites web et plateformes SaaS : chatbot RAG ancré sur vos contenus, search sémantique, personnalisation temps réel, génération éditoriale. TPE/PME/ETI, toute stack."
      : "Axion-IA integrates AI into your websites and SaaS platforms: RAG chatbot grounded in your content, semantic search, real-time personalisation, editorial generation. SMB/enterprise, any stack.",
    alternates: { fr: "/sites-web-augmentes", en: "/sites-web-augmentes" },
  });
}

export default async function SitesWebAugmentesHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    {
      href: "/sites-web-augmentes" as const,
      label: isFr ? "Sites web augmentés IA" : "AI-augmented websites",
    },
  ];

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Sites web & plateformes SaaS augmentés par l'IA · Axion-IA"
      : "AI-augmented websites & SaaS platforms · Axion-IA",
    description: isFr
      ? "Intégration de l'intelligence artificielle dans les sites web et plateformes SaaS existants ou conception d'expériences IA-natives : chatbot RAG, search sémantique, personnalisation, génération éditoriale."
      : "Integration of artificial intelligence into existing websites and SaaS platforms or design of AI-native experiences: RAG chatbot, semantic search, personalisation, editorial generation.",
    serviceType: isFr
      ? "Sites web & plateformes SaaS augmentés IA"
      : "AI-augmented websites & SaaS platforms",
    areasServed: buildServiceAreasServed(loc),
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Services d'augmentation IA pour sites web & plateformes SaaS — Axion-IA"
      : "AI augmentation services for websites & SaaS platforms — Axion-IA",
    items: [
      {
        position: 1,
        name: isFr ? "Chatbot RAG intégré" : "Integrated RAG chatbot",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Assistant conversationnel ancré sur vos contenus, zéro hallucination, hébergé UE."
          : "Conversational assistant grounded in your content, zero hallucination, EU-hosted.",
      },
      {
        position: 2,
        name: isFr ? "Search sémantique" : "Semantic search",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Recherche vectorielle comprenant l'intention des visiteurs, résultats pertinents."
          : "Vector search understanding visitor intent, relevant results.",
      },
      {
        position: 3,
        name: isFr
          ? "Génération & personnalisation éditoriale"
          : "Editorial generation & personalisation",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Pipeline de génération conforme HCU 2024 + AI Act, personnalisation temps réel."
          : "HCU 2024 + AI Act compliant generation pipeline, real-time personalisation.",
      },
    ],
  });

  // ImageObject @graph — Sprint perfection AEO 2026-05-28 (Will). Photo
  // équipe + portrait fondateur pour visibilité Google Images + citation
  // AI Overviews sur requêtes « site web IA », « SaaS native IA »,
  // « site web augmenté entreprise ».
  const sitesWebImagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — création sites web et SaaS native IA"
          : "Axion-IA team — AI-native websites and SaaS",
        alt: isFr
          ? "Équipe Axion-IA en session conception site web augmenté IA — sites vitrines, SaaS métier, plateformes B2B avec agents conversationnels intégrés pour TPE, PME, ETI et grandes entreprises françaises."
          : "Axion-IA team designing AI-augmented website — showcase sites, business SaaS, B2B platforms with integrated conversational agents for French SMEs, mid-caps and large enterprises.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA et architecte sites web IA"
          : "William — Axion-IA founder and AI website architect",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Pilote la création de sites web augmentés IA et SaaS native IA pour dirigeants TPE, PME, ETI et grandes entreprises françaises — agents conversationnels, recommandations IA, automatisations métier."
          : "Portrait of William, Axion-IA founder. Drives AI-augmented website and AI-native SaaS creation for French SME, mid-cap and large enterprise executives — conversational agents, AI recommendations, business automations.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-sites-web-augmentes-itemlist"
      />
      <JsonLd data={sitesWebImagesJsonLd} />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <SitesWebHero isFr={isFr} />
      <SitesWebTrustPills isFr={isFr} />
      <SitesWebStackAdaptee isFr={isFr} />
      <SitesWebMethodology isFr={isFr} />
      <SitesWebFaq isFr={isFr} />

      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'augmentation web & SaaS IA"
        serviceLabelEn="AI web & SaaS augmentation"
        serviceSlug="codage-developpement"
        tone="sand"
      />

      <LocalGeoFaqSection isFr={isFr} service="codage-developpement" tone="paper" />

      <SitesWebCtaBlock isFr={isFr} />

      <StickyMobileCta
        label={isFr ? "Demander un devis" : "Request a quote"}
        href="/demande-devis"
      />
    </>
  );
}
