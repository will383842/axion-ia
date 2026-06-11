// SSOT « squelette formation » — données + helpers.
//
// Une entrée par `tierId` de pricing.ts représentant une formation. Source
// unique de la DURÉE (archetypes ci-dessous) et du CONTENU pédagogique
// (programme). Les couches marketing + le seed Qualiopi en DÉRIVENT.
//
// Ajouter / modifier une formation = éditer ICI uniquement. La durée, le
// programme et le public se propagent à : interventions.ts, taxonomy,
// subpages (JSON-LD), booking-catalog, seed OffreSite. Voir skeletons.test.ts
// qui verrouille l'absence de dérive.

import {
  PRESENTIEL_DISTANCIEL,
  PRESENTIEL_SEUL,
  TOUTES_MODALITES,
  type ModalitePedagogique,
} from "./modalites";
import type {
  FormationDurationCanonical,
  FormationDurationId,
  FormationProgramme,
  FormationSkeleton,
} from "./types";

// ============================================================================
// Archetypes de durée — paliers canoniques. SOURCE de durationDays + ISO 8601.
// 1 jour = PT7H (décision 2026-06-11 : aligné sur les 6-8 h face-à-face Qualiopi,
// fin de la dérive PT7H/PT8H).
// ============================================================================

export const FORMATION_DURATIONS: Record<FormationDurationId, FormationDurationCanonical> = {
  "4h": {
    id: "4h",
    days: 0.5,
    iso: "PT4H",
    labelFr: "Demi-journée (4 h)",
    labelEn: "Half-day (4 h)",
    shortFr: "4 h",
    shortEn: "4 h",
    scheduleHintFr: "≈ 4 h sur site",
    scheduleHintEn: "≈ 4 h on site",
  },
  "1-jour": {
    id: "1-jour",
    days: 1,
    iso: "PT7H",
    labelFr: "1 journée",
    labelEn: "1 day",
    shortFr: "1 j",
    shortEn: "1 d",
    scheduleHintFr: "9 h – 17 h",
    scheduleHintEn: "9 a.m. – 5 p.m.",
  },
  "2-jours": {
    id: "2-jours",
    days: 2,
    iso: "P2D",
    labelFr: "2 jours",
    labelEn: "2 days",
    shortFr: "2 j",
    shortEn: "2 d",
    scheduleHintFr: "2 jours consécutifs",
    scheduleHintEn: "2 consecutive days",
  },
  "3-jours-plus": {
    id: "3-jours-plus",
    days: 3,
    iso: null, // durée variable sur devis
    labelFr: "3 jours et plus",
    labelEn: "3 days and more",
    shortFr: "3 j+",
    shortEn: "3 d+",
    scheduleHintFr: "3 jours ou plus — sur devis",
    scheduleHintEn: "3 days or more — on request",
  },
};

// ============================================================================
// Programmes pédagogiques — migrés 1:1 depuis interventions.ts (essentielle,
// dirigeants). Les 3 autres (approfondie / gagner-du-temps / intervention-claude)
// = slots `undefined` (Will rédigera). Le `logisticsNote` reste ajouté par le
// consommateur (interventions.ts) pour ne pas dupliquer LOGISTICS_NOTE_*.
// ============================================================================

const ESSENTIELLE_PROGRAMME: FormationProgramme = {
  titleFr: "Déroulement de la journée",
  titleEn: "Day-by-day breakdown",
  introFr:
    "Programme type d'une journée Essentielle (9 h – 17 h). Identique pour toutes les entreprises : des ressources pédagogiques standardisées remises en fin de journée pour être réutilisées dès le lendemain.",
  introEn:
    "Standard programme for the Essential day (9 a.m. – 5 p.m.). Identical for every company: standardised learning takeaways shared at end of day, ready to reuse the next morning.",
  days: [
    {
      items: [
        {
          time: "9 h 00",
          timeEn: "9:00",
          titleFr: "Accueil + tour de table + objectifs",
          titleEn: "Welcome + round table + objectives",
        },
        {
          time: "9 h 30",
          timeEn: "9:30",
          titleFr: "Découverte des outils IA principaux",
          titleEn: "Discovery of the main AI tools",
          descFr:
            "ChatGPT, Claude, Copilot, Gemini : à quoi ils servent vraiment et quand les choisir.",
          descEn: "ChatGPT, Claude, Copilot, Gemini: what they really do and when to pick each.",
        },
        { time: "10 h 30", timeEn: "10:30", titleFr: "Pause café", titleEn: "Coffee break" },
        {
          time: "10 h 45",
          timeEn: "10:45",
          titleFr: "Atelier 1 — Rédaction & communication assistées",
          titleEn: "Workshop 1 — AI-assisted writing & communication",
          descFr: "Mails, comptes-rendus, supports : prompts efficaces, garde-fous.",
          descEn: "Emails, minutes, decks: effective prompts, guardrails.",
        },
        {
          time: "12 h 00",
          timeEn: "12:00",
          titleFr: "Pause déjeuner (12 h – 14 h)",
          titleEn: "Lunch break (12:00 – 14:00)",
        },
        {
          time: "14 h 00",
          timeEn: "14:00",
          titleFr: "Atelier 2 — Recherche, analyse & synthèse",
          titleEn: "Workshop 2 — Research, analysis & synthesis",
          descFr: "Veille, extraction, traitement de documents et de données.",
          descEn: "Watch, extraction, document and data processing.",
        },
        { time: "15 h 00", timeEn: "15:00", titleFr: "Pause café", titleEn: "Coffee break" },
        {
          time: "15 h 15",
          timeEn: "15:15",
          titleFr: "Atelier 3 — Idées d'usages sur leurs outils",
          titleEn: "Workshop 3 — Automation ideas on their own tools",
          descFr:
            "Repérer les tâches répétitives et imaginer comment l'IA peut faire gagner du temps.",
          descEn: "Spotting repetitive tasks and imagining where AI saves time.",
        },
        {
          time: "16 h 30",
          timeEn: "16:30",
          titleFr: "Récap des usages + ressources fournies",
          titleEn: "Use-case recap + takeaways shared",
          descFr: "Référentiel des outils, prompts types, cas d'usage par métier.",
          descEn: "Tool reference sheet, prompt templates, use cases by role.",
        },
        {
          time: "17 h 00",
          timeEn: "17:00",
          titleFr: "Q&A ouverte + clôture",
          titleEn: "Open Q&A + close",
        },
      ],
    },
  ],
};

const DIRIGEANTS_PROGRAMME: FormationProgramme = {
  titleFr: "Déroulement de la journée",
  titleEn: "Day-by-day breakdown",
  introFr:
    "Programme type d'une journée Dirigeants (9 h – 17 h). Identique pour toutes les entreprises : panorama, ateliers de positionnement, référentiel d'arbitrage IA pour vos décisions futures.",
  introEn:
    "Standard programme for the Executives day (9 a.m. – 5 p.m.). Identical for every company: panorama, positioning workshops, AI decision framework for your future calls.",
  days: [
    {
      items: [
        {
          time: "9 h 00",
          timeEn: "9:00",
          titleFr: "Accueil + cadrage 1-to-1 avec le dirigeant",
          titleEn: "Welcome + 1-on-1 framing with the executive",
        },
        {
          time: "9 h 30",
          timeEn: "9:30",
          titleFr: "Panorama IA 2026 — opportunités, risques, marché",
          titleEn: "2026 AI panorama — opportunities, risks, market",
          descFr: "État de l'art, où en sont les concurrents, ce qui marche vraiment.",
          descEn: "State of the art, where competitors stand, what really works.",
        },
        { time: "11 h 00", timeEn: "11:00", titleFr: "Pause café", titleEn: "Coffee break" },
        {
          time: "11 h 15",
          timeEn: "11:15",
          titleFr: "Atelier 1 — Positionnement de votre entreprise",
          titleEn: "Workshop 1 — Position your company",
          descFr: "Échelle de maturité IA 2026 appliquée à votre contexte.",
          descEn: "2026 AI maturity scale applied to your context.",
        },
        {
          time: "12 h 00",
          timeEn: "12:00",
          titleFr: "Déjeuner avec le dirigeant (12 h – 14 h)",
          titleEn: "Lunch with the executive (12:00 – 14:00)",
        },
        {
          time: "14 h 00",
          timeEn: "14:00",
          titleFr: "Atelier 2 — Cas d'usage prioritaires par fonction",
          titleEn: "Workshop 2 — Priority use cases by function",
          descFr: "Quels usages testent les ETI/grandes entreprises de votre secteur.",
          descEn: "What mid-market and enterprise peers in your sector are testing.",
        },
        { time: "15 h 30", timeEn: "15:30", titleFr: "Pause", titleEn: "Break" },
        {
          time: "15 h 45",
          timeEn: "15:45",
          titleFr: "Atelier 3 — Référentiel d'arbitrage des décisions IA",
          titleEn: "Workshop 3 — AI decision framework",
          descFr: "Grille de lecture pour évaluer vos prochains choix IA en interne.",
          descEn: "Reading grid to assess your next internal AI choices.",
        },
        {
          time: "17 h 00",
          timeEn: "17:00",
          titleFr: "Synthèse + ressources pédagogiques + clôture",
          titleEn: "Synthesis + takeaways + close",
          descFr: "Référentiel dirigeant, cas d'usage, lectures recommandées.",
          descEn: "Executive reference sheet, use cases, recommended reading.",
        },
      ],
    },
  ],
};

// ============================================================================
// Squelettes — un par tier formation (miroir 1:1 du seed Qualiopi offres.ts).
// ============================================================================

export const FORMATION_SKELETONS: ReadonlyArray<FormationSkeleton> = [
  {
    id: "demarrage-ia-express",
    tierId: "intervention-4h",
    slugFr: "demarrage-ia-express",
    slugEn: "ai-express-kickoff",
    family: "collectives",
    collectiveDuration: "4h",
    duration: "4h",
    hoursMin: 4,
    hoursMax: 4,
    summaryDurationFr: "Demi-journée (4 h) sur site",
    summaryDurationEn: "Half-day (4 h) on site",
    publicViseFr:
      "TPE/PME et équipes souhaitant découvrir l'IA ou cadrer un cas d'usage métier précis.",
    modalites: PRESENTIEL_DISTANCIEL,
  },
  {
    id: "essentielle",
    tierId: "intervention-essentielle",
    slugFr: "essentielle",
    slugEn: "essential",
    family: "collectives",
    collectiveDuration: "1-jour",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée sur site (9 h – 17 h)",
    summaryDurationEn: "1 day on site (9 a.m. – 5 p.m.)",
    publicViseFr: "Équipes de 2 à 30 personnes découvrant l'IA opérationnelle.",
    modalites: TOUTES_MODALITES,
    programme: ESSENTIELLE_PROGRAMME,
  },
  {
    id: "gagner-du-temps",
    tierId: "intervention-temps",
    slugFr: "gagner-du-temps",
    slugEn: "save-time",
    family: "collectives",
    collectiveDuration: "1-jour",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée sur site",
    summaryDurationEn: "1 day on site",
    publicViseFr: "Équipes opérationnelles souhaitant automatiser leurs tâches récurrentes.",
    modalites: TOUTES_MODALITES,
  },
  {
    id: "approfondie",
    tierId: "intervention-approfondie",
    slugFr: "approfondie",
    slugEn: "deep-dive",
    family: "collectives",
    collectiveDuration: "2-jours",
    duration: "2-jours",
    hoursMin: 12,
    hoursMax: 14,
    summaryDurationFr: "2 jours consécutifs sur site",
    summaryDurationEn: "2 consecutive days on site",
    publicViseFr: "Équipes de 2 à 30 personnes visant un ancrage durable des pratiques IA.",
    modalites: TOUTES_MODALITES,
  },
  {
    id: "conference",
    tierId: "intervention-conference",
    slugFr: "conference",
    slugEn: "conference",
    family: "collectives",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée plénière sur site",
    summaryDurationEn: "1 plenary day on site",
    publicViseFr: "Grands effectifs (séminaires, kick-off annuels).",
    modalites: PRESENTIEL_SEUL,
  },
  {
    id: "dirigeants",
    tierId: "intervention-dirigeants",
    slugFr: "dirigeants",
    slugEn: "executive-productivity",
    family: "dirigeants",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée + rapport sous 7 jours",
    summaryDurationEn: "1 day + report within 7 days",
    publicViseFr: "Dirigeant en accompagnement individuel (1-to-1).",
    modalites: PRESENTIEL_DISTANCIEL,
    programme: DIRIGEANTS_PROGRAMME,
  },
  {
    id: "membre-equipe",
    tierId: "intervention-membre-equipe",
    slugFr: "membre-equipe",
    slugEn: "team-member",
    family: "individuel",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée sur site",
    summaryDurationEn: "1 day on site",
    publicViseFr: "Collaborateur clé en accompagnement individuel (1-to-1).",
    modalites: PRESENTIEL_DISTANCIEL,
  },
  {
    id: "intervention-claude",
    tierId: "intervention-claude",
    slugFr: "intervention-claude",
    slugEn: "intervention-claude",
    family: "collectives",
    collectiveDuration: "1-jour",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée sur site",
    summaryDurationEn: "1 day on site",
    publicViseFr: "Équipes de 2 à 30 personnes outillées sur Claude (Anthropic).",
    modalites: TOUTES_MODALITES,
  },
  {
    id: "dirigeant-vision-strategique",
    tierId: "intervention-dirigeant-vision",
    slugFr: "dirigeant-vision-strategique",
    slugEn: "executive-strategic-vision",
    family: "dirigeants",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée sur site",
    summaryDurationEn: "1 day on site",
    publicViseFr: "Dirigeant en accompagnement individuel (1-to-1).",
    modalites: PRESENTIEL_DISTANCIEL,
  },
  {
    id: "claude-dirigeant",
    tierId: "intervention-claude-dirigeant",
    slugFr: "claude-dirigeant",
    slugEn: "claude-executive",
    family: "dirigeants",
    duration: "1-jour",
    hoursMin: 6,
    hoursMax: 8,
    summaryDurationFr: "1 journée sur site",
    summaryDurationEn: "1 day on site",
    publicViseFr: "Dirigeant en accompagnement individuel (1-to-1), 100 % Claude.",
    modalites: PRESENTIEL_DISTANCIEL,
  },
  {
    id: "sur-demande",
    tierId: "intervention-sur-demande",
    slugFr: "sur-demande",
    slugEn: "on-request",
    family: "collectives",
    collectiveDuration: "3-jours-plus",
    duration: "3-jours-plus",
    hoursMin: 4,
    hoursMax: 21,
    summaryDurationFr: "Sur mesure — durée à cadrer",
    summaryDurationEn: "Bespoke — duration to scope",
    publicViseFr:
      "Configurations hors-cadre : multi-sites, multi-jours, offsite, contenus spécifiques.",
    modalites: TOUTES_MODALITES,
  },
] as const;

// ============================================================================
// Helpers
// ============================================================================

/** Descripteur canonique d'un palier durée (throw si id inconnu — invariant). */
export function getDurationCanonical(id: FormationDurationId): FormationDurationCanonical {
  const d = FORMATION_DURATIONS[id];
  if (!d) throw new Error(`[formations] Palier durée introuvable : "${id}"`);
  return d;
}

/** Squelette par identifiant stable (= slug marketing FR). */
export function getSkeletonById(id: string): FormationSkeleton | undefined {
  return FORMATION_SKELETONS.find((s) => s.id === id);
}

/** Squelette par tierId pricing.ts — clé du pont Qualiopi. */
export function getSkeletonByTier(tierId: string): FormationSkeleton | undefined {
  return FORMATION_SKELETONS.find((s) => s.tierId === tierId);
}

/** Squelette par slug (id, FR ou EN). */
export function getSkeletonBySlug(slug: string): FormationSkeleton | undefined {
  return FORMATION_SKELETONS.find((s) => s.id === slug || s.slugFr === slug || s.slugEn === slug);
}

/**
 * Durée ISO 8601 d'une formation (par id/slug/tierId). `undefined` si pas de
 * squelette ; `null` si durée variable (sur devis). Source unique du
 * `Course.hasCourseInstance.courseWorkload`.
 */
export function formationDurationIso(idOrSlugOrTier: string): string | null | undefined {
  const s =
    getSkeletonById(idOrSlugOrTier) ??
    getSkeletonBySlug(idOrSlugOrTier) ??
    getSkeletonByTier(idOrSlugOrTier);
  if (!s) return undefined;
  return getDurationCanonical(s.duration).iso;
}

/** Jours « réservation » d'une formation (blocage calendrier). */
export function formationDurationDays(
  idOrSlugOrTier: string,
): FormationDurationCanonical["days"] | undefined {
  const s =
    getSkeletonById(idOrSlugOrTier) ??
    getSkeletonBySlug(idOrSlugOrTier) ??
    getSkeletonByTier(idOrSlugOrTier);
  if (!s) return undefined;
  return getDurationCanonical(s.duration).days;
}

export type { ModalitePedagogique };
