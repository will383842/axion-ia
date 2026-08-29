/**
 * SitesWebRealisations — bande « Réalisations » en défilement infini, riche en
 * images (banque Axion-IA), placée après le bandeau contact.
 *
 * Fusion 2026-06-01 (Will) — calqué sur `AuditRealisations` (template /audit).
 * Absorbe les anciens « scénarios » texte (SaaS B2B / app existante / portail)
 * et les enrichit en cartes visuelles + métrique. Couvre PME / ETI / grands groupes, sans
 * nom de marque : profil de plateforme + secteur + résultat mesurable.
 *
 * Marquee 100 % CSS (anim `caseScrollX`, track dupliqué, pause au survol,
 * désactivé en `prefers-reduced-motion`). Server Component pur, zéro JS. FR
 * canonique — EN = miroir (locale 301→FR).
 */

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Container } from "@/components/layout/Container";

type Segment = "PME" | "ETI";

interface Realisation {
  readonly segment: Segment;
  readonly sectorFr: string;
  readonly sectorEn: string;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly metricFr: string;
  readonly metricEn: string;
  readonly outcomeFr: string;
  readonly outcomeEn: string;
  readonly image: string;
  readonly imageAltFr: string;
  readonly imageAltEn: string;
}

const SEGMENT_LABEL: Record<Segment, { fr: string; en: string }> = {
  PME: { fr: "PME", en: "SME" },
  ETI: { fr: "ETI & grands comptes", en: "Mid-cap & key accounts" },
};

// 8 réalisations web/SaaS — images de la banque Axion-IA existante.
const REALISATIONS: ReadonlyArray<Realisation> = [
  {
    segment: "PME",
    sectorFr: "Plateforme SaaS B2B",
    sectorEn: "B2B SaaS platform",
    titleFr: "Plateforme IA-native sur mesure",
    titleEn: "Bespoke AI-native platform",
    metricFr: "IA dès le sprint 1",
    metricEn: "AI from sprint 1",
    outcomeFr:
      "Agents IA, automatisations métier, search sémantique et chatbot intégrés dès la conception.",
    outcomeEn:
      "AI agents, business automations, semantic search and chatbot integrated from day one.",
    image: "/images/axion-ia-pipeline-marketing-lead-qualifie-scoring-crm-ia-banniere.webp",
    imageAltFr: "Plateforme SaaS B2B IA-native avec pipeline et scoring automatisés par l'IA",
    imageAltEn: "AI-native B2B SaaS platform with AI-automated pipeline and scoring",
  },
  {
    segment: "PME",
    sectorFr: "Site vitrine & service client",
    sectorEn: "Showcase site & customer service",
    titleFr: "Chatbot RAG greffé sur l'existant",
    titleEn: "RAG chatbot grafted on existing site",
    metricFr: "80 % de questions auto",
    metricEn: "80% questions auto-resolved",
    outcomeFr:
      "Assistant ancré sur le contenu du site, réponses précises 24h/7j, zéro hallucination.",
    outcomeEn: "Assistant grounded in the site content, accurate answers 24/7, zero hallucination.",
    image: "/images/axion-ia-traitement-reclamations-312-semaine-4-minutes-ia-banniere.webp",
    imageAltFr: "Chatbot RAG traitant automatiquement les demandes clients sur un site web",
    imageAltEn: "RAG chatbot automatically handling customer requests on a website",
  },
  {
    segment: "PME",
    sectorFr: "E-commerce",
    sectorEn: "E-commerce",
    titleFr: "Personnalisation temps réel",
    titleEn: "Real-time personalisation",
    metricFr: "+18 % d'engagement",
    metricEn: "+18% engagement",
    outcomeFr:
      "Contenu, CTAs et offres adaptés au profil de chaque visiteur — sans cookie tiers, RGPD strict.",
    outcomeEn:
      "Content, CTAs and offers adapted to each visitor's profile — no third-party cookie, strict GDPR.",
    image:
      "/images/axion-ia-personnalisation-temps-reel-2847-visiteurs-experience-unique-ia-banniere.webp",
    imageAltFr: "Personnalisation temps réel de l'expérience web par l'IA pour chaque visiteur",
    imageAltEn: "Real-time AI personalisation of the web experience for each visitor",
  },
  {
    segment: "PME",
    sectorFr: "Média & éditeur de contenu",
    sectorEn: "Media & content publisher",
    titleFr: "Génération éditoriale assistée",
    titleEn: "Assisted editorial generation",
    metricFr: "6 formats en 4 min",
    metricEn: "6 formats in 4 min",
    outcomeFr:
      "Pipeline conforme HCU 2024 + AI Act : brief unique décliné en blog, fiches, FAQ et réseaux.",
    outcomeEn:
      "HCU 2024 + AI Act compliant pipeline: one brief turned into blog, pages, FAQ and social.",
    image: "/images/axion-ia-generation-contenu-6-formats-4-minutes-brief-ia-infographie.webp",
    imageAltFr: "Génération de 6 formats de contenu en 4 minutes à partir d'un brief par l'IA",
    imageAltEn: "Generation of 6 content formats in 4 minutes from a brief by AI",
  },
  {
    segment: "ETI",
    sectorFr: "Portail client / espace membre",
    sectorEn: "Client portal / member area",
    titleFr: "Self-care augmenté par l'IA",
    titleEn: "AI-augmented self-care",
    metricFr: "−60 % de charge support",
    metricEn: "−60% support load",
    outcomeFr:
      "Chatbot RAG sur vos contenus, relances automatiques, personnalisation par profil client.",
    outcomeEn:
      "RAG chatbot on your content, automatic follow-ups, personalisation by client profile.",
    image:
      "/images/axion-ia-onboarding-rh-j-5-j90-90-pourcent-automatise-collaborateur-banniere.webp",
    imageAltFr: "Portail client avec self-care et onboarding automatisés par l'IA",
    imageAltEn: "Client portal with AI-automated self-care and onboarding",
  },
  {
    segment: "PME",
    sectorFr: "Application web existante",
    sectorEn: "Existing web application",
    titleFr: "Search sémantique sans refonte",
    titleEn: "Semantic search without rebuild",
    metricFr: "−40 % tickets niveau 1",
    metricEn: "−40% level-1 tickets",
    outcomeFr: "Recherche par le sens dans la doc et l'interface, greffée via API — zéro downtime.",
    outcomeEn: "Meaning-based search across docs and UI, grafted via API — zero downtime.",
    image: "/images/axion-ia-accueil-client-vip-automatique-onboarding-crm-banniere.webp",
    imageAltFr: "Recherche sémantique IA intégrée à une application web existante",
    imageAltEn: "AI semantic search integrated into an existing web application",
  },
  {
    segment: "PME",
    sectorFr: "Plateforme B2B & CRM",
    sectorEn: "B2B platform & CRM",
    titleFr: "Suggestions & scoring intelligents",
    titleEn: "Smart suggestions & scoring",
    metricFr: "+40 % de RDV qualifiés",
    metricEn: "+40% qualified meetings",
    outcomeFr: "Recommandations et relances au bon moment, branchées sur vos données métier.",
    outcomeEn: "Recommendations and follow-ups at the right time, wired to your business data.",
    image: "/images/axion-ia-crm-scoring-contacts-action-automatique-bon-moment-banniere.webp",
    imageAltFr: "Suggestions et scoring IA branchés sur le CRM d'une plateforme web",
    imageAltEn: "AI suggestions and scoring wired to the CRM of a web platform",
  },
  {
    segment: "ETI",
    sectorFr: "Back-office & opérations web",
    sectorEn: "Back-office & web operations",
    titleFr: "Automatisations métier intégrées",
    titleEn: "Integrated business automations",
    metricFr: "−30 % de tâches manuelles",
    metricEn: "−30% manual tasks",
    outcomeFr:
      "Workflows déclenchés par l'IA dans la plateforme — bénéfices concrets, mesurables, durables.",
    outcomeEn:
      "AI-triggered workflows inside the platform — concrete, measurable, lasting benefits.",
    image:
      "/images/axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-banniere.webp",
    imageAltFr: "Automatisations métier intégrées à une plateforme web par l'IA",
    imageAltEn: "Business automations integrated into a web platform by AI",
  },
];

function RealisationCard({ item, isFr }: { item: Realisation; isFr: boolean }): ReactNode {
  return (
    <article className="border-border bg-paper shadow-subtle hover:border-terracotta/50 hover:shadow-card flex w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border transition sm:w-[340px]">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={item.image}
          alt={isFr ? item.imageAltFr : item.imageAltEn}
          fill
          loading="lazy"
          decoding="async"
          sizes="340px"
          className="object-cover"
        />
        <span className="bg-paper/90 text-terracotta-deep absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase backdrop-blur">
          {isFr ? SEGMENT_LABEL[item.segment].fr : SEGMENT_LABEL[item.segment].en}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <span className="text-fg-muted text-[12px] font-semibold tracking-wide uppercase">
          {isFr ? item.sectorFr : item.sectorEn}
        </span>
        <h3 className="text-fg mt-2 text-[17px] leading-snug font-semibold tracking-tight">
          {isFr ? item.titleFr : item.titleEn}
        </h3>
        <p
          className="text-terracotta mt-3 text-2xl leading-none font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {isFr ? item.metricFr : item.metricEn}
        </p>
        <p className="text-fg-soft mt-2 text-[13.5px] leading-relaxed">
          {isFr ? item.outcomeFr : item.outcomeEn}
        </p>
      </div>
    </article>
  );
}

export function SitesWebRealisations({ isFr }: { isFr: boolean }): ReactNode {
  const tracks = [...REALISATIONS, ...REALISATIONS];

  return (
    <section
      aria-labelledby="sites-web-realisations-title"
      className="bg-bg relative overflow-hidden py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <header className="mb-14 max-w-3xl space-y-5">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Réalisations" : "Case studies"}
          </p>
          <h2
            id="sites-web-realisations-title"
            className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
          >
            {isFr ? "Des sites et plateformes IA," : "AI sites and platforms,"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "livrés et mesurés" : "delivered and measured"}
            </span>
          </h2>
          <p className="text-fg-soft max-w-2xl text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "Nouvelle plateforme ou augmentation de l'existant — du site vitrine au SaaS B2B, chaque mission part d'un besoin et se termine par un résultat mesurable."
              : "New platform or augmentation of an existing one — from showcase site to B2B SaaS, every engagement starts from a need and ends with a measurable result."}
          </p>
        </header>
      </Container>

      <div className="group relative">
        <div
          aria-hidden="true"
          className="from-bg pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r to-transparent sm:w-24"
        />
        <div
          aria-hidden="true"
          className="from-bg pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l to-transparent sm:w-24"
        />
        <ul
          className="case-marquee-track flex w-max list-none items-stretch gap-5 p-0 motion-reduce:animate-none sm:gap-6"
          style={
            {
              "--marquee-duration": "80s",
              animation: "caseScrollX var(--marquee-duration) linear infinite",
            } as CSSProperties
          }
        >
          {tracks.map((item, idx) => (
            <li key={`${item.sectorFr}-${idx}`} aria-hidden={idx >= REALISATIONS.length}>
              <RealisationCard item={item} isFr={isFr} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
