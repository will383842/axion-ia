/**
 * ImplementationRealisations — bande « Projets réalisés » en défilement infini
 * (droite → gauche). Calqué sur AuditRealisations, framé implémentation/agents
 * IA. 8 projets diversifiés (TPE / PME / ETI), NON cliquables. Aucun nom de
 * société/marque : secteur + résultat mesurable (contenu illustratif).
 *
 * Marquee 100 % CSS (anim `caseScrollX` de globals.css). Server Component pur,
 * zéro JS. Tokens uniquement. Aucun prix. FR canonique — EN = miroir (301→FR).
 */

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Container } from "@/components/layout/Container";

type Segment = "TPE" | "PME" | "ETI";

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
  TPE: { fr: "TPE", en: "Small business" },
  PME: { fr: "PME", en: "SME" },
  ETI: { fr: "ETI & grands comptes", en: "Mid-cap & key accounts" },
};

// 8 projets implémentés — TPE / PME / ETI. Images = banque Axion-IA existante.
const REALISATIONS: ReadonlyArray<Realisation> = [
  {
    segment: "TPE",
    sectorFr: "Artisan du bâtiment",
    sectorEn: "Construction craftsman",
    titleFr: "Agent de devis automatique",
    titleEn: "Automatic quoting agent",
    metricFr: "−70 % de temps",
    metricEn: "−70% time",
    outcomeFr: "Un agent qui rédige et envoie les devis, de la demande au client.",
    outcomeEn: "An agent that drafts and sends quotes, from request to client.",
    image: "/images/axion-ia-devis-automatise-30-secondes-envoi-gain-temps-banniere.webp",
    imageAltFr: "Agent IA de devis généré et envoyé automatiquement en quelques secondes",
    imageAltEn: "AI quoting agent generating and sending quotes automatically within seconds",
  },
  {
    segment: "TPE",
    sectorFr: "Cabinet d'expertise comptable",
    sectorEn: "Accounting firm",
    titleFr: "Agent comptable (factures)",
    titleEn: "Accounting agent (invoices)",
    metricFr: "÷2 le temps de saisie",
    metricEn: "Data entry halved",
    outcomeFr: "Capture, extraction et validation des factures, intégrées à votre logiciel.",
    outcomeEn: "Invoice capture, extraction and validation, integrated into your software.",
    image:
      "/images/axion-ia-gestion-factures-comptabilite-capture-extraction-validation-ia-banniere.webp",
    imageAltFr: "Factures capturées et validées automatiquement par l'IA en comptabilité",
    imageAltEn: "Invoices captured and validated automatically by AI in accounting",
  },
  {
    segment: "TPE",
    sectorFr: "Restaurant & hôtellerie",
    sectorEn: "Restaurant & hospitality",
    titleFr: "Chatbot avis & réservations",
    titleEn: "Reviews & bookings chatbot",
    metricFr: "×3 le taux de réponse",
    metricEn: "3× response rate",
    outcomeFr: "Réponses automatiques aux avis et accueil personnalisé à chaque réservation.",
    outcomeEn: "Automatic review replies and a personalised welcome on every booking.",
    image: "/images/axion-ia-accueil-client-vip-automatique-onboarding-crm-banniere.webp",
    imageAltFr: "Chatbot d'accueil client et réponses automatiques aux avis par IA",
    imageAltEn: "AI welcome chatbot and automatic review replies",
  },
  {
    segment: "PME",
    sectorFr: "Industrie & production",
    sectorEn: "Industry & manufacturing",
    titleFr: "Automatisation du planning",
    titleEn: "Scheduling automation",
    metricFr: "−30 % d'arrêts",
    metricEn: "−30% downtime",
    outcomeFr: "Détection des conflits en temps réel et planning de production fiabilisé.",
    outcomeEn: "Real-time conflict detection and a reliable production schedule.",
    image: "/images/axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere.webp",
    imageAltFr: "Planning de production IA avec conflits détectés en temps réel",
    imageAltEn: "AI production schedule with conflicts detected in real time",
  },
  {
    segment: "PME",
    sectorFr: "E-commerce",
    sectorEn: "E-commerce",
    titleFr: "Chatbot service client 24/7",
    titleEn: "24/7 customer-service chatbot",
    metricFr: "< 2 min de réponse",
    metricEn: "< 2 min reply",
    outcomeFr: "Première réponse jour et nuit, branchée sur votre back-office.",
    outcomeEn: "First reply day and night, wired into your back-office.",
    image: "/images/axion-ia-traitement-reclamations-312-semaine-4-minutes-ia-banniere.webp",
    imageAltFr: "Chatbot de traitement des réclamations clients accéléré par l'IA",
    imageAltEn: "AI chatbot accelerating customer-complaint handling",
  },
  {
    segment: "PME",
    sectorFr: "Agence immobilière",
    sectorEn: "Real-estate agency",
    titleFr: "Agent de qualification de leads",
    titleEn: "Lead-qualification agent",
    metricFr: "+40 % de RDV qualifiés",
    metricEn: "+40% qualified meetings",
    outcomeFr: "Scoring des contacts et relance au bon moment, synchronisés au CRM.",
    outcomeEn: "Contact scoring and timely follow-up, synced to the CRM.",
    image: "/images/axion-ia-pipeline-marketing-lead-qualifie-scoring-crm-ia-banniere.webp",
    imageAltFr: "Agent IA de qualification de leads et scoring CRM",
    imageAltEn: "AI lead-qualification agent and CRM scoring",
  },
  {
    segment: "ETI",
    sectorFr: "Réseau de distribution",
    sectorEn: "Retail network",
    titleFr: "Moteur de prévision des stocks",
    titleEn: "Stock-forecasting engine",
    metricFr: "−25 % de surstock",
    metricEn: "−25% overstock",
    outcomeFr: "Réassort anticipé à 45 jours, commandes déclenchées automatiquement.",
    outcomeEn: "Replenishment anticipated 45 days ahead, orders triggered automatically.",
    image:
      "/images/axion-ia-gestion-stocks-prevision-j45-commandes-automatiques-ia-infographie.webp",
    imageAltFr: "Moteur de prévision des stocks à 45 jours et commandes automatiques par IA",
    imageAltEn: "AI 45-day stock-forecasting engine and automatic ordering",
  },
  {
    segment: "ETI",
    sectorFr: "Groupe de cliniques",
    sectorEn: "Clinic group",
    titleFr: "Agent de comptes-rendus",
    titleEn: "Reporting agent",
    metricFr: "8 h/semaine libérées",
    metricEn: "8 h/week freed up",
    outcomeFr: "Comptes-rendus rédigés automatiquement, par praticien.",
    outcomeEn: "Reports written automatically, per practitioner.",
    image:
      "/images/axion-ia-compte-rendu-reunion-ecrit-automatiquement-equipe-bureau-banniere.webp",
    imageAltFr: "Agent IA rédigeant automatiquement les comptes-rendus pour les équipes",
    imageAltEn: "AI agent writing reports automatically for teams",
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

export function ImplementationRealisations({ isFr }: { isFr: boolean }): ReactNode {
  const tracks = [...REALISATIONS, ...REALISATIONS];

  return (
    <section
      aria-labelledby="impl-realisations-title"
      className="bg-bg relative overflow-hidden py-20 sm:py-24 lg:py-28"
    >
      <Container>
        <header className="mb-14 max-w-3xl space-y-5">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Projets réalisés" : "Projects delivered"}
          </p>
          <h2
            id="impl-realisations-title"
            className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
          >
            {isFr ? "Des solutions IA livrées," : "AI solutions delivered,"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "pour toutes les tailles d'entreprise" : "for companies of every size"}
            </span>
          </h2>
          <p className="text-fg-soft max-w-2xl text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "De l'artisan à l'ETI, chaque projet finit par une solution qui tourne et un résultat mesurable. Voici un aperçu de ce que nous implémentons."
              : "From the sole trader to the mid-cap, every project ends with a running solution and a measurable result. Here's a glimpse of what we implement."}
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
            <li
              key={`${item.segment}-${item.sectorFr}-${idx}`}
              aria-hidden={idx >= REALISATIONS.length}
            >
              <RealisationCard item={item} isFr={isFr} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
