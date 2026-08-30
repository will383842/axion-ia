/**
 * AuditRealisations — bande « Réalisations » en défilement infini (droite →
 * gauche), placée juste après AuditWhyChooseUs (« Le seul partenaire qui
 * maîtrise toute la chaîne IA, de bout en bout »).
 *
 * Refonte 2026-05-31 (Will) — 8 projets diversifiés, NON cliquables, qui
 * défilent. Couvre PME / ETI / grands groupes. Aucun nom de société ou de marque : secteur
 * + résultat mesurable uniquement (anti-invention).
 *
 * v2 (Will 2026-05-31) — header au style standard du site (eyebrow terracotta +
 * titre serif avec mot en italique, comme les autres sections) + chaque carte
 * porte une IMAGE de la banque + une métrique mise en avant, pour un rendu plus
 * visuel et cohérent.
 *
 * Marquee 100 % CSS (anim `caseScrollX` de globals.css, track dupliqué →
 * translateX -50% pour boucler sans saut, pause au survol, désactivé en
 * `prefers-reduced-motion`). Server Component pur, zéro JS. Design tokens
 * uniquement (pas de hex). FR canonique — EN = miroir (locale 301→FR).
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
  /** Métrique forte, mise en avant visuellement. */
  readonly metricFr: string;
  readonly metricEn: string;
  readonly outcomeFr: string;
  readonly outcomeEn: string;
  /** Image de la banque (public/images/...), bannière paysage. */
  readonly image: string;
  readonly imageAltFr: string;
  readonly imageAltEn: string;
}

const SEGMENT_LABEL: Record<Segment, { fr: string; en: string }> = {
  PME: { fr: "PME", en: "SME" },
  ETI: { fr: "ETI & grands comptes", en: "Mid-cap & key accounts" },
};

// 8 réalisations diversifiées — PME / ETI / grands groupes, secteurs variés. Images = banque
// Axion-IA existante (public/images), choisies pour coller au cas d'usage.
const REALISATIONS: ReadonlyArray<Realisation> = [
  {
    segment: "PME",
    sectorFr: "Artisan du bâtiment",
    sectorEn: "Construction craftsman",
    titleFr: "Devis générés automatiquement",
    titleEn: "Auto-generated quotes",
    metricFr: "−70 % de temps",
    metricEn: "−70% time",
    outcomeFr: "Sur la rédaction des devis, de la demande à l'envoi au client.",
    outcomeEn: "On quote drafting, from request to sending it to the client.",
    image: "/images/axion-ia-devis-automatise-30-secondes-envoi-gain-temps-banniere.webp",
    imageAltFr: "Devis IA généré et envoyé automatiquement en quelques secondes",
    imageAltEn: "AI quote generated and sent automatically within seconds",
  },
  {
    segment: "PME",
    sectorFr: "Cabinet d'expertise comptable",
    sectorEn: "Accounting firm",
    titleFr: "Saisie comptable assistée par IA",
    titleEn: "AI-assisted bookkeeping",
    metricFr: "÷2 le temps de saisie",
    metricEn: "Data entry halved",
    outcomeFr: "Capture, extraction et validation des factures en trois mois.",
    outcomeEn: "Invoice capture, extraction and validation within three months.",
    image:
      "/images/axion-ia-gestion-factures-comptabilite-capture-extraction-validation-ia-banniere.webp",
    imageAltFr: "Factures capturées et validées automatiquement par l'IA en comptabilité",
    imageAltEn: "Invoices captured and validated automatically by AI in accounting",
  },
  {
    segment: "PME",
    sectorFr: "Restaurant & hôtellerie",
    sectorEn: "Restaurant & hospitality",
    titleFr: "Réponses aux avis & réservations",
    titleEn: "Reviews & bookings replies",
    metricFr: "×3 le taux de réponse",
    metricEn: "3× response rate",
    outcomeFr: "Aux avis clients, avec un accueil personnalisé à chaque réservation.",
    outcomeEn: "To customer reviews, with a personalised welcome on every booking.",
    image: "/images/axion-ia-accueil-client-vip-automatique-onboarding-crm-banniere.webp",
    imageAltFr: "Accueil client VIP automatisé et réponses aux avis par IA",
    imageAltEn: "Automated VIP customer welcome and AI review replies",
  },
  {
    segment: "PME",
    sectorFr: "Industrie & production",
    sectorEn: "Industry & manufacturing",
    titleFr: "Maintenance prédictive",
    titleEn: "Predictive maintenance",
    metricFr: "−30 % d'arrêts",
    metricEn: "−30% downtime",
    outcomeFr: "Arrêts non planifiés anticipés, planning de production fiabilisé.",
    outcomeEn: "Unplanned stops anticipated, production schedule made reliable.",
    image: "/images/axion-ia-planning-chantier-gantt-ia-conflits-detectes-temps-reel-banniere.webp",
    imageAltFr: "Planning de production IA avec conflits détectés en temps réel",
    imageAltEn: "AI production schedule with conflicts detected in real time",
  },
  {
    segment: "PME",
    sectorFr: "E-commerce",
    sectorEn: "E-commerce",
    titleFr: "Service client augmenté 24/7",
    titleEn: "24/7 augmented customer support",
    metricFr: "< 2 min de réponse",
    metricEn: "< 2 min reply",
    outcomeFr: "Première réponse jour et nuit, sans surcoût d'équipe.",
    outcomeEn: "First reply day and night, with no extra headcount.",
    image: "/images/axion-ia-traitement-reclamations-312-semaine-4-minutes-ia-banniere.webp",
    imageAltFr: "Traitement des réclamations clients accéléré par l'IA",
    imageAltEn: "Customer complaint handling accelerated by AI",
  },
  {
    segment: "PME",
    sectorFr: "Agence immobilière",
    sectorEn: "Real-estate agency",
    titleFr: "Qualification automatique des leads",
    titleEn: "Automatic lead qualification",
    metricFr: "+40 % de RDV qualifiés",
    metricEn: "+40% qualified meetings",
    outcomeFr: "Scoring des contacts et relance au bon moment, sans saisie.",
    outcomeEn: "Contact scoring and follow-up at the right time, no manual entry.",
    image: "/images/axion-ia-pipeline-marketing-lead-qualifie-scoring-crm-ia-banniere.webp",
    imageAltFr: "Pipeline de leads qualifiés et scoring CRM par l'IA",
    imageAltEn: "Qualified lead pipeline and CRM scoring by AI",
  },
  {
    segment: "ETI",
    sectorFr: "Réseau de distribution",
    sectorEn: "Retail network",
    titleFr: "Prévision de la demande",
    titleEn: "Demand forecasting",
    metricFr: "−25 % de surstock",
    metricEn: "−25% overstock",
    outcomeFr: "Réassort anticipé à 45 jours, commandes déclenchées automatiquement.",
    outcomeEn: "Replenishment anticipated 45 days ahead, orders triggered automatically.",
    image:
      "/images/axion-ia-gestion-stocks-prevision-j45-commandes-automatiques-ia-infographie.webp",
    imageAltFr: "Prévision des stocks à 45 jours et commandes automatiques par IA",
    imageAltEn: "45-day stock forecasting and automatic ordering by AI",
  },
  {
    segment: "ETI",
    sectorFr: "Groupe de cliniques",
    sectorEn: "Clinic group",
    titleFr: "Synthèse automatisée des dossiers",
    titleEn: "Automated case summaries",
    metricFr: "8 h/semaine libérées",
    metricEn: "8 h/week freed up",
    outcomeFr: "Comptes-rendus rédigés automatiquement, par praticien.",
    outcomeEn: "Reports written automatically, per practitioner.",
    image:
      "/images/axion-ia-compte-rendu-reunion-ecrit-automatiquement-equipe-bureau-banniere.webp",
    imageAltFr: "Compte-rendu rédigé automatiquement par l'IA pour les équipes",
    imageAltEn: "Report written automatically by AI for teams",
  },
];

function RealisationCard({ item, isFr }: { item: Realisation; isFr: boolean }): ReactNode {
  return (
    <article className="border-border bg-paper shadow-subtle hover:border-terracotta/50 hover:shadow-card flex w-[300px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border transition sm:w-[340px]">
      {/* Visuel projet */}
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

      {/* Contenu */}
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

export function AuditRealisations({ isFr }: { isFr: boolean }): ReactNode {
  // Dupliqué pour une boucle continue (translateX -50% → défile droite→gauche).
  const tracks = [...REALISATIONS, ...REALISATIONS];

  return (
    <section
      aria-labelledby="audit-realisations-title"
      className="bg-bg relative overflow-hidden py-20 sm:py-24 lg:py-28"
    >
      {/* Header — markup identique au composant Section (eyebrow text-fg-muted +
          dot terracotta, h2 sans-serif semibold, mot en serif italique terracotta)
          pour une cohérence stricte avec les autres sections (Will 2026-05-31). */}
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
            id="audit-realisations-title"
            className="text-fg text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.04] font-semibold tracking-tight"
          >
            {isFr ? "Des projets livrés," : "Projects delivered,"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "pour les PME, ETI et grands groupes" : "for SMEs, mid-caps and large groups"}
            </span>
          </h2>
          <p className="text-fg-soft max-w-2xl text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "De l'artisan à l'ETI, chaque mission part d'un audit et se termine par un résultat mesurable. Voici un aperçu de ce que nous déployons."
              : "From the sole trader to the mid-cap, every engagement starts with an audit and ends with a measurable result. Here is a glimpse of what we deploy."}
          </p>
        </header>
      </Container>

      {/* Marquee pleine largeur — défilement droite → gauche, pause au survol */}
      <div className="group relative">
        {/* Fondus latéraux pour une entrée/sortie propre */}
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
