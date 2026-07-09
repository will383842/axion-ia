// Modèle « gains concrets » du simulateur /roi.
//
// Doctrine (Will 2026-07-09) : le chiffre HÉRO reste une durée — les heures
// rendues à l'équipe. La valorisation en euros existe, mais elle est OPT-IN
// (repliée par défaut dans l'UI) : on parle temps d'abord, argent ensuite.
//
// ⚠️ HONNÊTETÉ DES CHIFFRES. Les constantes ci-dessous sont des HYPOTHÈSES DE
// MODÈLE, pas les résultats d'une étude. La page les expose intégralement (bloc
// « Notre modèle d'estimation ») et le simulateur affiche un avertissement.
// Aucune affirmation du type « observé sur N entreprises » ne doit réapparaître
// ici sans étude publiable derrière : ce serait une pratique commerciale
// trompeuse au sens de l'article L121-2 du Code de la consommation.
//
// Le seul levier d'incertitude explicite est le SCÉNARIO D'ADOPTION, qui fait
// varier l'efficacité de 40 % à 75 % — l'utilisateur choisit lui-même son
// hypothèse plutôt que de subir un chiffre unique présenté comme une vérité.
//
// Pure compute, aucune dépendance React — testable et réutilisable.

import { ESSENTIELLE_SUB_TIERS } from "@/content/pricing";
import type { ClientSectorSlug } from "@/content/sectors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Scénario d'adoption interne choisi par l'utilisateur. */
export type RoiAdoption = "prudent" | "realiste" | "ambitieux";

/** Les 4 familles de tâches répétitives adressées par une formation IA. */
export type RoiTaskFamily = "redaction" | "recherche" | "synthese" | "reporting";

/** Secteur du simulateur : les 10 secteurs clients SSOT, plus un cas générique. */
export type RoiSectorKey = ClientSectorSlug | "generique";

export interface RoiInputs {
  /** Collaborateurs concernés par la formation. */
  readonly teamSize: number;
  /** Heures par jour, par personne, aujourd'hui consacrées aux tâches répétitives. */
  readonly hoursDailyOnRepetitive: number;
  /** Scénario d'adoption interne. Pilote l'efficacité appliquée. */
  readonly adoption: RoiAdoption;
  /** Secteur — détermine la répartition des heures par famille de tâches. */
  readonly sector: RoiSectorKey;
  /** Coût horaire chargé moyen, en euros. Sert uniquement au bloc « valeur financière ». */
  readonly hourlyCostEur: number;
}

export interface RoiTaskSlice {
  readonly family: RoiTaskFamily;
  /** Part de l'effort répétitif portée par cette famille, en % entier (somme = 100). */
  readonly sharePct: number;
  /** Heures rendues par semaine sur l'équipe, imputables à cette famille. */
  readonly hoursPerWeekTeam: number;
}

export interface RoiMoney {
  readonly hourlyCostEur: number;
  /** Valeur annuelle des heures rendues (heures × coût horaire chargé). */
  readonly annualValueEur: number;
  /** Coût de la formation, dérivé du SSOT `pricing.ts` selon l'effectif. */
  readonly trainingCostEur: number;
  /** Nombre de sessions nécessaires (une session accueille au plus 30 personnes). */
  readonly sessionsNeeded: number;
  /**
   * Jours ouvrés avant que les heures rendues aient couvert le coût de la
   * formation. `null` quand le gain est nul (aucun retour possible).
   */
  readonly paybackWorkingDays: number | null;
}

export interface RoiResult {
  /** Efficacité effectivement appliquée (dérivée du scénario d'adoption). */
  readonly efficiency: number;
  /** Heures gagnées par jour, par personne — le chiffre central de la page. */
  readonly hoursSavedPerDayPerPerson: number;
  readonly hoursSavedPerWeekTeam: number;
  readonly hoursSavedPerYearTeam: number;
  /** Jours de travail libérés par mois sur l'équipe. */
  readonly daysLiberatedPerMonth: number;
  /** Part du temps quotidien rendue à la valeur ajoutée, en % entier. */
  readonly pctTimeFreedDaily: number;
  /** Équivalents temps plein récupérés sur l'année (1 décimale). */
  readonly fteRecovered: number;
  /** Ventilation des heures rendues par famille de tâches. */
  readonly taskBreakdown: readonly RoiTaskSlice[];
  readonly emailsAssistedPerMonth: number;
  readonly reportsAssistedPerMonth: number;
  readonly money: RoiMoney;
}

// ---------------------------------------------------------------------------
// Hypothèses du modèle — toutes exposées publiquement sur la page
// ---------------------------------------------------------------------------

/**
 * Efficacité appliquée aux tâches répétitives selon le scénario d'adoption.
 * Fourchette volontairement large : l'écart entre une équipe qui outille
 * réellement ses workflows et une équipe qui « a suivi la formation » est le
 * premier facteur de variance.
 */
export const ADOPTION_EFFICIENCY: Readonly<Record<RoiAdoption, number>> = {
  prudent: 0.4,
  realiste: 0.6,
  ambitieux: 0.75,
};

export const ROI_CONSTANTS = {
  /** Durée légale d'une journée de travail en France (35 h / 5 j). */
  hoursPerDay: 7,
  /** Jours ouvrés par mois (moyenne annuelle lissée). */
  workingDaysPerMonth: 21,
  /** Jours ouvrés par an, hors congés payés et RTT. */
  workingDaysPerYear: 218,
  /** Durée légale annuelle du travail en France — base du calcul d'ETP. */
  annualHoursPerFte: 1607,
  /** Emails / messages professionnels rédigés par jour et par personne. */
  emailsSentPerDayPerPerson: 30,
  /** Comptes-rendus et synthèses produits par mois et par personne. */
  reportsPerMonthPerPerson: 8,
  /** Effectif maximum d'une session de formation collective (cf. `pricing.ts`). */
  maxPeoplePerSession: 30,
  /** Coût horaire chargé par défaut, en euros. */
  defaultHourlyCostEur: 45,
} as const;

/** Bornes de saisie de l'UI — sliders et tests partagent la même vérité. */
export const ROI_BOUNDS = {
  teamSize: { min: 1, max: 250, step: 1 },
  hoursDailyOnRepetitive: { min: 0, max: 6, step: 0.5 },
  hourlyCostEur: { min: 20, max: 150, step: 5 },
} as const;

// ---------------------------------------------------------------------------
// Préréglages sectoriels
// ---------------------------------------------------------------------------

export interface RoiSectorPreset {
  /** Heures répétitives quotidiennes typiques du secteur — présélectionne le slider. */
  readonly hoursDailyOnRepetitive: number;
  /** Répartition de l'effort répétitif entre les 4 familles. Somme = 100. */
  readonly taskMixPct: Readonly<Record<RoiTaskFamily, number>>;
}

/**
 * Répartition indicative de l'effort répétitif par secteur. Sert à donner du
 * grain au résultat, pas à prétendre à une précision statistique : deux
 * cabinets d'un même secteur peuvent avoir des profils très différents.
 */
export const ROI_SECTOR_PRESETS: Readonly<Record<RoiSectorKey, RoiSectorPreset>> = {
  generique: {
    hoursDailyOnRepetitive: 3,
    taskMixPct: { redaction: 35, recherche: 25, synthese: 20, reporting: 20 },
  },
  comptabilite_finance: {
    hoursDailyOnRepetitive: 3.5,
    taskMixPct: { redaction: 20, recherche: 25, synthese: 20, reporting: 35 },
  },
  btp_immobilier: {
    hoursDailyOnRepetitive: 2.5,
    taskMixPct: { redaction: 35, recherche: 20, synthese: 25, reporting: 20 },
  },
  restauration_hotellerie: {
    hoursDailyOnRepetitive: 2,
    taskMixPct: { redaction: 40, recherche: 20, synthese: 15, reporting: 25 },
  },
  sante_medecine: {
    hoursDailyOnRepetitive: 3,
    taskMixPct: { redaction: 25, recherche: 25, synthese: 35, reporting: 15 },
  },
  juridique: {
    hoursDailyOnRepetitive: 4,
    taskMixPct: { redaction: 30, recherche: 35, synthese: 25, reporting: 10 },
  },
  commerce_retail: {
    hoursDailyOnRepetitive: 2.5,
    taskMixPct: { redaction: 40, recherche: 20, synthese: 15, reporting: 25 },
  },
  industrie_logistique: {
    hoursDailyOnRepetitive: 2.5,
    taskMixPct: { redaction: 20, recherche: 25, synthese: 20, reporting: 35 },
  },
  artisanat_services: {
    hoursDailyOnRepetitive: 2,
    taskMixPct: { redaction: 45, recherche: 20, synthese: 15, reporting: 20 },
  },
  rh_recrutement: {
    hoursDailyOnRepetitive: 3.5,
    taskMixPct: { redaction: 35, recherche: 25, synthese: 30, reporting: 10 },
  },
  collectivites_public: {
    hoursDailyOnRepetitive: 3,
    taskMixPct: { redaction: 30, recherche: 20, synthese: 30, reporting: 20 },
  },
};

/** Ordre d'affichage des familles de tâches dans le graphe de répartition. */
export const ROI_TASK_FAMILIES: readonly RoiTaskFamily[] = [
  "redaction",
  "recherche",
  "synthese",
  "reporting",
];

// ---------------------------------------------------------------------------
// Coût de la formation — dérivé du SSOT `pricing.ts`, jamais hardcodé
// ---------------------------------------------------------------------------

// `getTierById` contraint sur `PricingTier` ; les sous-tiers sont des
// `PricingSubTier` (pas de description) → lookup local, même sémantique.
function subTierPrice(id: string): number {
  const tier = ESSENTIELLE_SUB_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`[roi] sous-tier Essentielle introuvable : "${id}"`);
  return tier.priceFlat;
}

const ESSENTIELLE_SMALL_GROUP_EUR = subTierPrice("essentielle-standard");
const ESSENTIELLE_LARGE_GROUP_EUR = subTierPrice("essentielle-complete");

/** Effectif au-delà duquel une session bascule sur le tarif « grand groupe ». */
const SMALL_GROUP_MAX_PEOPLE = 15;

/**
 * Coût d'une formation Essentielle pour `teamSize` personnes. Au-delà de 30
 * participants, on additionne autant de sessions « grand groupe » que nécessaire.
 * Les deux prix unitaires viennent de `ESSENTIELLE_SUB_TIERS` (SSOT pricing).
 */
export function computeTrainingCost(teamSize: number): {
  trainingCostEur: number;
  sessionsNeeded: number;
} {
  if (teamSize <= 0) return { trainingCostEur: 0, sessionsNeeded: 0 };

  const sessionsNeeded = Math.ceil(teamSize / ROI_CONSTANTS.maxPeoplePerSession);
  if (sessionsNeeded === 1) {
    const price =
      teamSize <= SMALL_GROUP_MAX_PEOPLE
        ? ESSENTIELLE_SMALL_GROUP_EUR
        : ESSENTIELLE_LARGE_GROUP_EUR;
    return { trainingCostEur: price, sessionsNeeded: 1 };
  }
  return {
    trainingCostEur: sessionsNeeded * ESSENTIELLE_LARGE_GROUP_EUR,
    sessionsNeeded,
  };
}

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeRoi(inputs: RoiInputs): RoiResult {
  const teamSize = clamp(inputs.teamSize, 0, ROI_BOUNDS.teamSize.max);
  const hoursDaily = clamp(inputs.hoursDailyOnRepetitive, 0, ROI_BOUNDS.hoursDailyOnRepetitive.max);
  const hourlyCostEur = clamp(
    inputs.hourlyCostEur,
    ROI_BOUNDS.hourlyCostEur.min,
    ROI_BOUNDS.hourlyCostEur.max,
  );
  const efficiency = ADOPTION_EFFICIENCY[inputs.adoption];
  const preset = ROI_SECTOR_PRESETS[inputs.sector] ?? ROI_SECTOR_PRESETS.generique;

  const { hoursPerDay, workingDaysPerMonth, workingDaysPerYear, annualHoursPerFte } = ROI_CONSTANTS;

  // Chiffre central — heures rendues par jour, par personne.
  const hoursSavedPerDayPerPerson = round1(hoursDaily * efficiency);

  const hoursSavedPerWeekTeam = Math.round(hoursSavedPerDayPerPerson * teamSize * 5);
  const hoursSavedPerYearTeam = Math.round(
    hoursSavedPerDayPerPerson * teamSize * workingDaysPerYear,
  );
  const daysLiberatedPerMonth = Math.round(
    (hoursSavedPerDayPerPerson * teamSize * workingDaysPerMonth) / hoursPerDay,
  );
  const pctTimeFreedDaily = Math.round((hoursSavedPerDayPerPerson / hoursPerDay) * 100);
  const fteRecovered = round1(hoursSavedPerYearTeam / annualHoursPerFte);

  // Ventilation par famille de tâches : on répartit les heures RENDUES, donc le
  // mix sectoriel décrit d'où vient le gain, pas où va le temps restant.
  const taskBreakdown: RoiTaskSlice[] = ROI_TASK_FAMILIES.map((family) => {
    const sharePct = preset.taskMixPct[family];
    return {
      family,
      sharePct,
      hoursPerWeekTeam: Math.round((hoursSavedPerWeekTeam * sharePct) / 100),
    };
  });

  const emailsAssistedPerMonth = Math.round(
    teamSize * ROI_CONSTANTS.emailsSentPerDayPerPerson * workingDaysPerMonth * efficiency,
  );
  const reportsAssistedPerMonth = Math.round(
    teamSize * ROI_CONSTANTS.reportsPerMonthPerPerson * efficiency,
  );

  // ── Valorisation financière (opt-in côté UI) ────────────────────────────
  const annualValueEur = Math.round(hoursSavedPerYearTeam * hourlyCostEur);
  const { trainingCostEur, sessionsNeeded } = computeTrainingCost(teamSize);
  const dailyValueEur = hoursSavedPerDayPerPerson * teamSize * hourlyCostEur;
  const paybackWorkingDays =
    dailyValueEur > 0 && trainingCostEur > 0 ? Math.ceil(trainingCostEur / dailyValueEur) : null;

  return {
    efficiency,
    hoursSavedPerDayPerPerson,
    hoursSavedPerWeekTeam,
    hoursSavedPerYearTeam,
    daysLiberatedPerMonth,
    pctTimeFreedDaily,
    fteRecovered,
    taskBreakdown,
    emailsAssistedPerMonth,
    reportsAssistedPerMonth,
    money: {
      hourlyCostEur,
      annualValueEur,
      trainingCostEur,
      sessionsNeeded,
      paybackWorkingDays,
    },
  };
}
