/**
 * Hub vertical unique — Sites web & plateformes SaaS augmentés par l'IA.
 *
 * Fusion 2026-06-01 (Will) — page hub canonique unique résultant de la fusion de
 * l'ancien `/codage-developpement` (+ sous-page `/web-digital`) dans cette page
 * (anti-cannibalisation keyword ; 301 dans `next.config.ts`). Template aligné sur
 * `/audit` : narration value-first riche en images (hero schema → logos → why →
 * modules + popup capacités → méthodologie → contact → réalisations → avis →
 * why-choose-us → stack/logos → réassurance → why-now → contact → couverture →
 * geo-FAQ → FAQ → connaissances → CTA → sticky).
 *
 * La page n'émet que `Service` + `ItemList` + `ImageObject` globaux : le HowTo est
 * émis par `SitesWebMethodology`, le FAQPage par `SitesWebFaq`, le Speakable par
 * `SitesWebHero` (évite les doublons). Le slug géo `LocalCoverageSection` /
 * `LocalGeoFaqSection` a été renommé `sites-web-augmentes` (union fermée).
 *
 * Server Components purs (zéro JS hors `FaqAccordion` + `StickyMobileCta`) →
 * budget Web Vitals 2026 préservé. ISR 1 h.
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
import { ClientLogosMarqueeBand } from "@/components/services/audit/ClientLogosMarqueeBand";
import { SitesWebHero } from "@/components/services/sites-web/SitesWebHero";
import { SitesWebTrustPills } from "@/components/services/sites-web/SitesWebTrustPills";
import { SitesWebWhy } from "@/components/services/sites-web/SitesWebWhy";
import { SitesWebModules } from "@/components/services/sites-web/SitesWebModules";
import { SitesWebCapabilitiesGrid } from "@/components/services/sites-web/SitesWebCapabilitiesGrid";
import { SitesWebVisualShowcase } from "@/components/services/sites-web/SitesWebVisualShowcase";
import { SitesWebLandingLinks } from "@/components/services/sites-web/SitesWebLandingLinks";
import { SitesWebMethodology } from "@/components/services/sites-web/SitesWebMethodology";
import { SitesWebContactBand } from "@/components/services/sites-web/SitesWebContactBand";
import { SitesWebRealisations } from "@/components/services/sites-web/SitesWebRealisations";
import { ServiceReviewsSection } from "@/components/reviews/ServiceReviewsSection";
import { SitesWebWhyChooseUs } from "@/components/services/sites-web/SitesWebWhyChooseUs";
import { SitesWebStackAdaptee } from "@/components/services/sites-web/SitesWebStackAdaptee";
import { SitesWebWhyNow } from "@/components/services/sites-web/SitesWebWhyNow";
import { SitesWebFaq } from "@/components/services/sites-web/SitesWebFaq";
import { SitesWebCtaBlock } from "@/components/services/sites-web/SitesWebCtaBlock";
import { RelatedKnowledge } from "@/components/services/RelatedKnowledge";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { VisibiliteCallout } from "@/components/visibilite/VisibiliteCallout";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildCollectionPageJsonLd,
  buildPageImageGraphJsonLd,
  buildPrimaryImageOfPage,
  SITE_URL,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { SERVICE_BY_ID, serviceOfficial } from "@/content/services";
import { ServiceJourneyBand } from "@/components/services/ServiceJourneyBand";

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
      ? "Sites web & SaaS augmentés par l'IA · Axion-IA"
      : "AI-augmented websites & SaaS platforms · Axion-IA",
    description: isFr
      ? "Un site, tout le monde en a un. Nous, on le rend intelligent. Chatbot RAG, search sémantique, agents IA — sur votre existant ou conçu de A à Z. Hébergement UE, vos données."
      : "AI-augmented websites and SaaS platforms: RAG chatbot grounded in your content, agents, semantic search, automations. Any stack, EU hosting, quote in 24-48 h.",
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
      label: serviceOfficial(SERVICE_BY_ID.sitesWeb, isFr),
    },
  ];

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Sites web & plateformes SaaS augmentés par l'IA · Axion-IA"
      : "AI-augmented websites & SaaS platforms · Axion-IA",
    description: isFr
      ? "Intégration de l'intelligence artificielle dans les sites web et plateformes SaaS existants, ou conception de plateformes IA-natives sur mesure : chatbot RAG, search sémantique, agents autonomes, automatisations métier, génération éditoriale, personnalisation. Toute stack moderne, hébergement UE."
      : "Integration of artificial intelligence into existing websites and SaaS platforms, or design of bespoke AI-native platforms: RAG chatbot, semantic search, autonomous agents, business automations, editorial generation, personalisation. Any modern stack, EU hosting.",
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
        name: isFr ? "Agents & automatisations IA" : "AI agents & automations",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Agents autonomes et automatisations des processus métier répétitifs, intégrés à vos outils."
          : "Autonomous agents and automation of repetitive business processes, integrated with your tools.",
      },
      {
        position: 4,
        name: isFr
          ? "Génération & personnalisation éditoriale"
          : "Editorial generation & personalisation",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Pipeline de génération conforme HCU 2024 + AI Act, personnalisation temps réel."
          : "HCU 2024 + AI Act compliant generation pipeline, real-time personalisation.",
      },
      {
        position: 5,
        name: isFr ? "Plateforme SaaS sur mesure IA-native" : "Bespoke AI-native SaaS platform",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Conception et développement d'une plateforme web sur mesure avec l'IA intégrée dès la conception."
          : "Design and development of a bespoke web platform with AI integrated from day one.",
      },
    ],
  });

  // ImageObject @graph — Sprint perfection AEO. Photo équipe + portrait fondateur
  // pour visibilité Google Images + citation AI Overviews sur requêtes « site web
  // IA », « plateforme SaaS native IA », « site web augmenté entreprise ».
  const sitesWebImagesJsonLd = buildPageImageGraphJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
  });
  // CollectionPage — porteur VALIDE du `speakable` (h1/h2 + réponses) + `primaryImageOfPage`.
  const sitesWebPageJsonLd = buildCollectionPageJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Sites web & plateformes SaaS augmentés par l'IA · Axion-IA"
      : "AI-augmented websites & SaaS platforms · Axion-IA",
    description: isFr
      ? "Un site, tout le monde en a un. Nous, on le rend intelligent. Chatbot RAG, search sémantique, agents IA — sur votre existant ou conçu de A à Z. Hébergement UE, vos données."
      : "AI-augmented websites and SaaS platforms: RAG chatbot grounded in your content, agents, semantic search, automations. Any stack, EU hosting, quote in 24-48 h.",
    speakable: true,
    ...(buildPrimaryImageOfPage("/sites-web-augmentes")
      ? { extra: { primaryImageOfPage: buildPrimaryImageOfPage("/sites-web-augmentes") } }
      : {}),
  });

  return (
    <>
      {/* Service inline (SEO racine critique), ItemList différé afterInteractive. */}
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={sitesWebPageJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-sites-web-augmentes-itemlist"
      />
      {sitesWebImagesJsonLd ? <JsonLd data={sitesWebImagesJsonLd} /> : null}

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO value-first 2-col + schéma orbital 8 nœuds IA (+ Speakable) */}
      <SitesWebHero isFr={isFr} />

      {/* PREUVE SOCIALE — bandeau logos clients défilant (juste après le hero) */}
      <ClientLogosMarqueeBand isFr={isFr} />

      {/* POSITIONNEMENT — bandeau « parcours » commun aux 5 hubs (audit
          positionnement 2026-07-28). Placé APRÈS le hero pour ne pas
          déplacer l'élément LCP. */}
      <ServiceJourneyBand currentId="sitesWeb" isFr={isFr} />

      {/* POURQUOI — contraste « tout refaire ❌ vs augmenter l'existant ✅ » */}
      <SitesWebWhy isFr={isFr} />

      {/* MODULES — 4 briques IA chiffrées (les plus demandées) */}
      <SitesWebModules isFr={isFr} />

      {/* CHAMP DES POSSIBLES — grille on-page 14 domaines (design, mobile, e-commerce, IA) */}
      <SitesWebCapabilitiesGrid isFr={isFr} />

      {/* EN IMAGES — bande visuelle 6 photos Unsplash (design/dev/e-commerce/mobile/data/équipe) */}
      <SitesWebVisualShowcase isFr={isFr} />

      {/* LIENS LANDINGS — maillage descendant vers les pages détail (anti-orphelin) */}
      <SitesWebLandingLinks isFr={isFr} />

      {/* MÉTHODOLOGIE — 5 étapes (audit → livraison) + HowTo JSON-LD */}
      <SitesWebMethodology isFr={isFr} />

      {/* BANDEAU TERRACOTTA CONTACT #1 — orientation/cadrage */}
      <SitesWebContactBand isFr={isFr} variant="scope" />

      {/* RÉALISATIONS — marquee à images (sites & plateformes IA livrés) */}
      <SitesWebRealisations isFr={isFr} />

      {/* AVIS CLIENTS — 6 portraits + note 5 étoiles */}
      <ServiceReviewsSection serviceLine="sites_web_augmentes" />

      {/* POURQUOI NOUS CHOISIR + transparence on-fait/on-ne-fait-pas */}
      <SitesWebWhyChooseUs isFr={isFr} />

      {/* STACK — modèles IA (logos) + frameworks/CMS supportés */}
      <SitesWebStackAdaptee isFr={isFr} />

      {/* RÉASSURANCE — 4 pills */}
      <SitesWebTrustPills isFr={isFr} />

      {/* POURQUOI MAINTENANT */}
      <SitesWebWhyNow isFr={isFr} />

      {/* BANDEAU TERRACOTTA CONTACT #2 — passage au devis */}
      <SitesWebContactBand isFr={isFr} variant="quote" />

      {/* COUVERTURE NATIONALE (pSEO) */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'augmentation web & SaaS IA"
        serviceLabelEn="AI web & SaaS augmentation"
        serviceSlug="sites-web-augmentes"
        tone="sand"
      />

      {/* FAQ GÉOLOCALISÉE (GEO) */}
      <LocalGeoFaqSection
        isFr={isFr}
        service="sites-web-augmentes"
        tone="paper"
        emitJsonLd={false}
      />

      {/* FAQ (unique, fusionnée) + FAQPage JSON-LD */}
      <SitesWebFaq isFr={isFr} />

      {/* CONNAISSANCES LIÉES — KB V4.1 Service Binding (masqué si vide) */}
      <RelatedKnowledge service="sites-web-augmentes" />

      {/* CTA FINAL mocha — pont vers audit */}
      <VisibiliteCallout isFr={isFr} />

      <SitesWebCtaBlock isFr={isFr} />

      {/* STICKY CTA MOBILE */}
      <StickyMobileCta
        label={isFr ? "Décrire mon projet" : "Describe my project"}
        href="/contact"
        track="sites-web-augmentes-sticky"
      />
    </>
  );
}
