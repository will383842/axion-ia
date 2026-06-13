// Configs SSOT des pages détail format — Sprint 14.10.7 (Will 2026-05-12).
//
// Centralise le contenu de chaque page détail format (hero + chips + benefits
// + programme + FAQ) pour les formats Dirigeants + Claude Implementation
// Individuel (les coachings individuels et formations 4 h ont leur propre
// template). Famille Conférence retirée 2026-05-28.
//
// Avantage : 1 seule source de vérité pour le contenu format, le template
// `InterventionDetailPage` rend chaque page de façon identique → harmonie
// visuelle parfaite entre les pages.

import { Compass, Sparkles, TrendingUp, Target, Eye, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { INTERVENTION_TIERS, getTierById } from "./pricing";

export type InterventionDetailSlug = "dirigeant-vision-strategique";

export interface DetailBenefit {
  icon: LucideIcon;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

export interface DetailScheduleItem {
  time: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
}

export interface DetailFaq {
  qFr: string;
  qEn: string;
  aFr: string;
  aEn: string;
}

export interface InterventionDetailConfig {
  slug: InterventionDetailSlug;
  /** Slug du format dans INTERVENTION_FORMATS pour lookup taxonomy. */
  formatSlug: string;
  /** Famille pour breadcrumbs (collectives / individuel / dirigeants). */
  familySlug: "dirigeants" | "individuel" | "collectives";
  /** Objet pré-rempli pour /interventions/demande. */
  contactObject: string;
  titleFr: string;
  titleEn: string;
  titleEmFr: string;
  titleEmEn: string;
  promiseFr: string;
  promiseEn: string;
  chipsFr: ReadonlyArray<string>;
  chipsEn: ReadonlyArray<string>;
  benefits: ReadonlyArray<DetailBenefit>;
  /** Programme : `null` si format sur devis sans planning fixe (Will). */
  schedule: ReadonlyArray<DetailScheduleItem> | null;
  scheduleTitleFr?: string;
  scheduleTitleEn?: string;
  faq: ReadonlyArray<DetailFaq>;
  /** Si défini : prix fixe en € HT pour le badge hero. */
  priceFlatEur?: number;
  /** Si défini : tag effectif pour le badge hero. */
  groupSizeFr: string;
  groupSizeEn: string;
}

// ============================================================================
// DIRIGEANTS — 2 formats (Vision stratégique / Claude)
// ============================================================================

const DIRIGEANT_VISION_BENEFITS: ReadonlyArray<DetailBenefit> = [
  {
    icon: Eye,
    titleFr: "Voir clairement où va votre secteur",
    titleEn: "See clearly where your sector is heading",
    bodyFr:
      "Panorama IA 2026 ciblé sur VOTRE secteur d'activité : ce que font vraiment les concurrents, qui prend de l'avance, quels usages se généralisent. Pas de buzz, des faits.",
    bodyEn:
      "2026 AI panorama focused on YOUR sector: what competitors actually do, who is gaining ground, which uses are becoming standard. No buzz, just facts.",
  },
  {
    icon: Lightbulb,
    titleFr: "Identifier les opportunités stratégiques",
    titleEn: "Identify strategic opportunities",
    bodyFr:
      "On regarde votre business model et on identifie 5 à 10 leviers IA stratégiques : nouvelles offres possibles, optimisations process majeurs, services additionnels, gains de marge — chacun chiffré en potentiel.",
    bodyEn:
      "We look at your business model and identify 5 to 10 strategic AI levers: possible new offerings, major process optimisations, additional services, margin gains — each quantified in potential.",
  },
  {
    icon: Compass,
    titleFr: "Penser différemment l'entreprise",
    titleEn: "Think the company differently",
    bodyFr:
      "Atelier de réflexion stratégique : comment l'IA peut transformer votre organisation, vos métiers, votre rapport client. Pas un plan à exécuter — un déclic pour penser autrement.",
    bodyEn:
      "Strategic thinking workshop: how AI can transform your organisation, your roles, your customer relationship. Not a plan to execute — a shift to think differently.",
  },
  {
    icon: Target,
    titleFr: "Plan stratégique en surface, pas un audit",
    titleEn: "Surface strategic plan, not a full audit",
    bodyFr:
      "À l'issue : note de cadrage stratégique sous 7 jours, avec priorités identifiées et orientations. Pas un audit complet (plus long, plus profond) — un point de départ clair pour vos décisions.",
    bodyEn:
      "By the end: strategic framing note within 7 days, with identified priorities and orientations. Not a full audit (longer, deeper) — a clear starting point for your decisions.",
  },
];

const DIRIGEANT_VISION_SCHEDULE: ReadonlyArray<DetailScheduleItem> = [
  {
    time: "9 h 00",
    titleFr: "Accueil + état de votre entreprise (vision dirigeant)",
    titleEn: "Welcome + state of your company (executive view)",
  },
  {
    time: "9 h 30",
    titleFr: "Panorama IA 2026 ciblé sur votre secteur",
    titleEn: "2026 AI panorama focused on your sector",
    descriptionFr:
      "État de l'art, mouvements concurrents, signaux faibles, opportunités émergentes.",
    descriptionEn: "State of the art, competitor moves, weak signals, emerging opportunities.",
  },
  {
    time: "11 h 00",
    titleFr: "Pause café",
    titleEn: "Coffee break",
  },
  {
    time: "11 h 15",
    titleFr: "Atelier 1 — Cartographie stratégique de votre business",
    titleEn: "Workshop 1 — Strategic mapping of your business",
    descriptionFr:
      "Forces, faiblesses, modèle économique — où l'IA peut accélérer, où elle peut menacer.",
    descriptionEn:
      "Strengths, weaknesses, business model — where AI can accelerate, where it can threaten.",
  },
  {
    time: "12 h 30",
    titleFr: "Déjeuner stratégique (12 h 30 – 14 h)",
    titleEn: "Strategic lunch (12:30 – 14:00)",
  },
  {
    time: "14 h 00",
    titleFr: "Atelier 2 — 5 à 10 leviers stratégiques chiffrés",
    titleEn: "Workshop 2 — 5 to 10 quantified strategic levers",
    descriptionFr:
      "Nouvelles offres, optimisations majeures, services additionnels — potentiel quantifié.",
    descriptionEn:
      "New offerings, major optimisations, additional services — quantified potential.",
  },
  {
    time: "15 h 30",
    titleFr: "Pause",
    titleEn: "Break",
  },
  {
    time: "15 h 45",
    titleFr: "Atelier 3 — Penser différemment grâce à l'IA",
    titleEn: "Workshop 3 — Think differently thanks to AI",
    descriptionFr:
      "Brainstorming dirigé : comment transformer l'organisation, les métiers, la relation client.",
    descriptionEn:
      "Guided brainstorming: how to transform the organisation, roles, customer relationship.",
  },
  {
    time: "17 h 00",
    titleFr: "Synthèse + note de cadrage stratégique sous 7 jours",
    titleEn: "Synthesis + strategic framing note within 7 days",
  },
];

const DIRIGEANT_VISION_FAQ: ReadonlyArray<DetailFaq> = [
  {
    qFr: "Quelle différence avec un audit IA complet ?",
    qEn: "What's the difference with a full AI audit?",
    aFr: "Vision IA = 1 journée 1-to-1 avec vous, en surface (panorama, leviers, déclic). Audit IA = analyse approfondie sur plusieurs jours/semaines, multi-services, multi-entretiens. Vision = point de départ stratégique ; audit = plan d'action détaillé chiffré.",
    aEn: "AI Vision = 1 day 1-on-1 with you, at surface level (panorama, levers, shift). AI Audit = deep analysis over several days/weeks, multi-department, multi-interview. Vision = strategic starting point; audit = detailed quantified action plan.",
  },
  {
    qFr: "Est-ce que c'est applicable à mon secteur ?",
    qEn: "Is it applicable to my sector?",
    aFr: "Oui. La journée est construite sur VOTRE secteur, pas générique. On vous demande en amont 3 sujets clés pour préparer un panorama réellement utile. Tous secteurs : industrie, services, BTP, e-commerce, professions libérales, etc.",
    aEn: "Yes. The day is built on YOUR sector, not generic. We ask for 3 key topics upstream to prepare a truly useful panorama. All sectors: industry, services, construction, e-commerce, professional services, etc.",
  },
  {
    qFr: "Et après la journée, si je veux approfondir ?",
    qEn: "What if I want to dig deeper after the day?",
    aFr: "La note de cadrage sous 7 jours identifie les priorités. Si vous voulez un audit complet, on bascule vers le module Audit IA (sur devis selon profondeur). Si vous voulez former vos équipes, vers le module Interventions équipe.",
    aEn: "The framing note within 7 days identifies priorities. If you want a full audit, we move to the AI Audit module (on request based on depth). If you want to train your teams, to the Team Interventions module.",
  },
];

// ============================================================================
// CONFIG MAP
// ============================================================================

export const INTERVENTION_DETAIL_CONFIGS: Record<InterventionDetailSlug, InterventionDetailConfig> =
  {
    "dirigeant-vision-strategique": {
      slug: "dirigeant-vision-strategique",
      formatSlug: "dirigeant-vision-strategique",
      familySlug: "dirigeants",
      contactObject: "dirigeant-vision-strategique",
      priceFlatEur: getTierById(INTERVENTION_TIERS, "intervention-dirigeant-vision").priceFlat!,
      titleFr: "Vision IA stratégique",
      titleEn: "Strategic AI vision",
      titleEmFr: "Le déclic en 1 journée",
      titleEmEn: "The shift in 1 day",
      promiseFr:
        "Une journée 1-to-1 pour ouvrir les yeux du dirigeant sur ce que l'IA change DANS SON SECTEUR. Panorama des opportunités stratégiques, ce que font vraiment vos concurrents, comment penser différemment votre entreprise, quels leviers stratégiques activer. Pas un audit — un déclic stratégique.",
      promiseEn:
        "A 1-on-1 day to open the executive's eyes to what AI changes IN THEIR SECTOR. Strategic opportunity panorama, what competitors actually do, how to think your company differently, which strategic levers to activate. Not an audit — a strategic shift.",
      chipsFr: [
        "Panorama sectoriel ciblé",
        "5-10 leviers chiffrés",
        "Note de cadrage sous 7 jours",
      ],
      chipsEn: ["Targeted sector panorama", "5-10 quantified levers", "Framing note within 7 days"],
      benefits: DIRIGEANT_VISION_BENEFITS,
      schedule: DIRIGEANT_VISION_SCHEDULE,
      faq: DIRIGEANT_VISION_FAQ,
      groupSizeFr: "1 dirigeant (1-to-1 strict)",
      groupSizeEn: "1 executive (strict 1-on-1)",
    },
  };
