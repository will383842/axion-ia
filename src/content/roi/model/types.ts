// Simulateur de gains v2 — types du modèle (2026-08-12).
//
// ── Pourquoi une v2 ────────────────────────────────────────────────────────
// La v1 (`components/roi/compute.ts`) demandait au dirigeant « combien d'heures
// par jour passez-vous sur des tâches répétitives ? ». C'est LE chiffre qu'un
// dirigeant ne connaît pas. Il répondait au jugé, et tout le calcul en
// découlait : un résultat que l'utilisateur savait lui-même avoir inventé.
//
// La v2 inverse la charge de la preuve. On ne demande QUE des grandeurs qu'un
// dirigeant connaît de tête ou retrouve en dix secondes (« combien de devis par
// semaine ? », « combien de factures par mois ? »), et le modèle reconstruit le
// temps BOTTOM-UP, tâche par tâche :
//
//     heures_an = volume_annuel × minutes_unitaires / 60
//     gain_an   = heures_an × taux_automatisation × facteur_maturité
//
// Conséquence : chaque euro affiché est traçable jusqu'à une ligne du
// référentiel (`tasks.ts`), donc défendable devant un dirigeant sceptique.
//
// ⚠️ HONNÊTETÉ DU MODÈLE. Les `minutesPerUnit` et `automationRate` sont des
// HYPOTHÈSES DE MODÈLE argumentées, pas les résultats d'une étude. Chaque tâche
// porte un `proofFr` qui dit sur quoi repose son taux. Aucune formulation du
// type « observé sur N entreprises » ne doit apparaître sans étude publiable :
// ce serait une pratique commerciale trompeuse (art. L121-2 du Code de la
// consommation). Voir la doctrine héritée de la v1.
//
// Fichier PUR : aucun import React, aucun I/O → utilisable client, serveur,
// worker PDF et tests.

import type { ClientSectorSlug } from "@/content/sectors";

/**
 * Secteur retenu par le simulateur : les 10 secteurs clients canoniques, plus
 * un profil générique pour les métiers hors liste. En générique, le modèle
 * s'interdit les tâches et les pondérations sectorielles — on ne prétend pas
 * connaître un métier que l'utilisateur n'a pas nommé.
 */
export type RoiSectorKey = ClientSectorSlug | "generique";

// ---------------------------------------------------------------------------
// Fonctions de l'entreprise
// ---------------------------------------------------------------------------

/**
 * Les fonctions présentes dans une entreprise. Le questionnaire demande
 * lesquelles existent réellement, puis n'interroge QUE celles-là : un artisan
 * seul ne voit jamais les questions RH, un cabinet de 40 personnes les voit
 * toutes. C'est ce qui rend le questionnaire adaptatif court sans le rendre
 * générique.
 */
export type BusinessFunction =
  | "direction"
  | "administratif"
  | "commercial"
  | "relation_client"
  | "production"
  | "marketing"
  | "rh"
  | "finance";

export interface BusinessFunctionDef {
  readonly id: BusinessFunction;
  readonly labelFr: string;
  /** Formulation à la première personne, telle qu'elle apparaît dans le wizard. */
  readonly questionLabelFr: string;
  /** Précision courte qui lève l'ambiguïté sur le périmètre de la fonction. */
  readonly hintFr: string;
}

// ---------------------------------------------------------------------------
// Grandeurs mesurables
// ---------------------------------------------------------------------------

/**
 * Clé d'une grandeur que le questionnaire sait collecter. C'est le pivot du
 * modèle : les QUESTIONS produisent des volumes, les TÂCHES les consomment.
 * Découpler les deux permet qu'une même réponse alimente plusieurs tâches
 * (un volume de devis nourrit la rédaction du devis ET sa relance).
 */
export type VolumeKey =
  // Administratif
  | "factures_emises_mois"
  | "saisie_documents_mois"
  | "emails_traites_jour"
  | "rdv_planifies_semaine"
  // Commercial
  | "devis_emis_semaine"
  | "relances_commerciales_mois"
  | "prospects_qualifies_mois"
  | "propositions_longues_mois"
  // Relation client
  | "appels_entrants_jour"
  | "demandes_ecrites_jour"
  | "reclamations_mois"
  // Production / métier
  | "comptes_rendus_semaine"
  | "recherches_documentaires_semaine"
  | "documents_rediges_semaine"
  | "controles_conformite_mois"
  // Marketing
  | "publications_mois"
  | "articles_rediges_mois"
  // RH
  | "candidatures_recues_mois"
  | "entretiens_menes_mois"
  | "onboardings_an"
  // Finance / direction
  | "reportings_produits_mois"
  | "rapprochements_mois";

export interface VolumeDef {
  readonly key: VolumeKey;
  readonly fn: BusinessFunction;
  /** Période de la grandeur — sert à annualiser. */
  readonly period: "jour" | "semaine" | "mois" | "an";
  /** Nom de l'unité au singulier / pluriel, pour les phrases du rapport. */
  readonly unitFr: readonly [singular: string, plural: string];
}

/**
 * Facteurs d'annualisation. `jour` et `semaine` utilisent les jours et semaines
 * OUVRÉS : une entreprise ne produit pas de devis le dimanche.
 */
export const ANNUALIZATION: Readonly<Record<VolumeDef["period"], number>> = {
  jour: 218,
  semaine: 44,
  mois: 12,
  an: 1,
};

// ---------------------------------------------------------------------------
// Tâches automatisables — le référentiel
// ---------------------------------------------------------------------------

/**
 * Niveau de confiance dans le taux d'automatisation annoncé. Pilote la LARGEUR
 * de la fourchette du rapport, pas sa valeur centrale : une tâche très
 * standardisée (relance de facture impayée) est annoncée avec une fourchette
 * serrée, une tâche dépendant fortement du contexte (recherche documentaire)
 * avec une fourchette large. Afficher une fourchette honnête vaut mieux qu'un
 * chiffre unique faussement précis.
 */
export type TaskConfidence = "haute" | "moyenne" | "prudente";

/** Demi-largeur relative de la fourchette, par niveau de confiance. */
export const CONFIDENCE_SPREAD: Readonly<Record<TaskConfidence, number>> = {
  haute: 0.15,
  moyenne: 0.25,
  prudente: 0.4,
};

/**
 * Effort de mise en œuvre, de 1 (le jour même, avec les outils grand public)
 * à 5 (projet d'intégration avec le SI existant). Entre au dénominateur du
 * score de priorité : sans lui, le simulateur recommanderait toujours le
 * chantier le plus lourd en premier — le pire conseil possible à un dirigeant
 * qui n'a encore rien automatisé.
 */
export type TaskEffort = 1 | 2 | 3 | 4 | 5;

/** Levier Axion-IA qui adresse la tâche. Alimente la feuille de route. */
export type TaskLever = "formation" | "un_a_un" | "audit" | "implementation" | "site";

export interface AutomatableTask {
  readonly id: string;
  readonly fn: BusinessFunction;
  /** Ce que fait l'humain aujourd'hui, formulé comme un dirigeant le dirait. */
  readonly labelFr: string;
  /** Grandeur qui porte le volume. Si elle n'est pas collectée, la tâche est ignorée. */
  readonly volumeKey: VolumeKey;
  /**
   * Temps unitaire médian AVANT automatisation, en minutes. Concerne le temps
   * réellement passé sur l'acte, interruptions et reprises comprises.
   */
  readonly minutesPerUnit: number;
  /**
   * Part du temps unitaire réellement supprimable, de 0 à 1. JAMAIS 1 : il
   * reste toujours la relecture, la décision et l'envoi. Une tâche à 0 n'a
   * rien à faire ici — elle appartient à `non-automatable.ts`.
   */
  readonly automationRate: number;
  readonly confidence: TaskConfidence;
  readonly effort: TaskEffort;
  /** Semaines avant le premier gain mesurable, mise en place comprise. */
  readonly weeksToValue: number;
  readonly lever: TaskLever;
  /** Comment on l'automatise, concrètement. Apparaît dans le rapport. */
  readonly howFr: string;
  /** Sur quoi repose le taux annoncé. C'est la ligne qui rend le chiffre défendable. */
  readonly proofFr: string;
  /**
   * Secteurs concernés. `undefined` = tâche transversale, valable partout.
   * Une tâche listée ici n'apparaît que pour les secteurs cités.
   */
  readonly sectors?: readonly ClientSectorSlug[];
  /**
   * Multiplicateurs sectoriels du temps unitaire. Un compte-rendu en cabinet
   * juridique n'a pas le poids d'un compte-rendu en restauration.
   */
  readonly sectorMinutesFactor?: Partial<Record<ClientSectorSlug, number>>;
}

/**
 * Une tâche que le modèle refuse explicitement d'automatiser, et pourquoi.
 * Ce bloc n'est pas décoratif : un simulateur qui sait dire « non, pas ça » est
 * le seul qu'on croit quand il dit « oui, ça ». Il désamorce aussi la première
 * objection du dirigeant (« l'IA ne peut pas faire mon métier ») en lui donnant
 * raison avant qu'il l'ait formulée.
 */
export interface NonAutomatableTask {
  readonly id: string;
  readonly fn: BusinessFunction;
  readonly labelFr: string;
  /** La raison, en une phrase. Pas de langue de bois. */
  readonly reasonFr: string;
  readonly sectors?: readonly ClientSectorSlug[];
}

// ---------------------------------------------------------------------------
// Maturité numérique
// ---------------------------------------------------------------------------

/**
 * Où en est l'entreprise aujourd'hui. Remplace le « scénario d'adoption » de la
 * v1, qui demandait au prospect de choisir lui-même son hypothèse d'efficacité
 * — une question à laquelle personne ne peut répondre honnêtement. Ici on
 * demande un FAIT (quels outils sont déjà en place), et le modèle en déduit le
 * facteur. Une entreprise déjà outillée capte ses gains plus vite et plus
 * complètement : les données sont propres, les process écrits, les équipes
 * habituées au changement.
 */
export type DigitalMaturity = "papier" | "bureautique" | "outille" | "avance";

export interface MaturityDef {
  readonly id: DigitalMaturity;
  readonly labelFr: string;
  readonly hintFr: string;
  /** Multiplicateur appliqué au gain de CHAQUE tâche. */
  readonly factor: number;
  /** Semaines ajoutées au délai de mise en œuvre de chaque tâche. */
  readonly weeksPenalty: number;
}

export const MATURITY_LEVELS: readonly MaturityDef[] = [
  {
    id: "papier",
    labelFr: "Beaucoup de papier et de saisie manuelle",
    hintFr:
      "Les informations existent, mais elles ne sont pas encore exploitables par une machine.",
    factor: 0.7,
    weeksPenalty: 4,
  },
  {
    id: "bureautique",
    labelFr: "Bureautique classique",
    hintFr: "Word, Excel, une boîte mail. Peu ou pas de logiciel métier.",
    factor: 0.85,
    weeksPenalty: 2,
  },
  {
    id: "outille",
    labelFr: "Logiciels métier en place",
    hintFr: "CRM, logiciel de facturation ou de gestion, données déjà structurées.",
    factor: 1,
    weeksPenalty: 0,
  },
  {
    id: "avance",
    labelFr: "Outils connectés entre eux",
    hintFr: "Les logiciels se parlent déjà, des automatisations existent.",
    factor: 1.1,
    weeksPenalty: 0,
  },
] as const;

// ---------------------------------------------------------------------------
// Constantes légales et de cadrage
// ---------------------------------------------------------------------------

export const ROI_MODEL_CONSTANTS = {
  /** Durée légale d'une journée de travail en France (35 h / 5 j). */
  hoursPerDay: 7,
  /** Jours ouvrés par an, hors congés payés et RTT. */
  workingDaysPerYear: 218,
  /** Semaines ouvrées par an (52 moins congés). */
  workingWeeksPerYear: 44,
  /** Durée légale annuelle du travail en France — base du calcul d'ETP. */
  annualHoursPerFte: 1607,
  /** Coût horaire chargé par défaut, en euros, si le dirigeant ne le règle pas. */
  defaultHourlyCostEur: 45,
  /** Bornes du coût horaire chargé réglable. */
  hourlyCostMinEur: 25,
  hourlyCostMaxEur: 150,
  /** Nombre de tâches détaillées dans le plan d'action du rapport. */
  topTasksInReport: 5,
} as const;

// ---------------------------------------------------------------------------
// Entrées et sorties du moteur
// ---------------------------------------------------------------------------

/** Tranche d'effectif — un dirigeant choisit une tranche, il ne saisit pas 37. */
export type HeadcountBand = "1" | "2-5" | "6-10" | "11-20" | "21-50" | "51-100" | "100+";

export interface HeadcountDef {
  readonly id: HeadcountBand;
  readonly labelFr: string;
  /** Valeur retenue pour les calculs (médiane de la tranche). */
  readonly midpoint: number;
}

export const HEADCOUNT_BANDS: readonly HeadcountDef[] = [
  { id: "1", labelFr: "Je suis seul", midpoint: 1 },
  { id: "2-5", labelFr: "2 à 5", midpoint: 3 },
  { id: "6-10", labelFr: "6 à 10", midpoint: 8 },
  { id: "11-20", labelFr: "11 à 20", midpoint: 15 },
  { id: "21-50", labelFr: "21 à 50", midpoint: 33 },
  { id: "51-100", labelFr: "51 à 100", midpoint: 70 },
  { id: "100+", labelFr: "Plus de 100", midpoint: 140 },
] as const;

/**
 * Réponses brutes du questionnaire. Tout est optionnel sauf le cadrage : une
 * grandeur non renseignée est EXCLUE du total plutôt qu'estimée. C'est le choix
 * conservateur — le rapport annonce alors moins que la réalité, jamais plus, et
 * il le dit (`unmeasuredFunctions`).
 */
export interface RoiAnswers {
  readonly sector: RoiSectorKey;
  readonly headcount: HeadcountBand;
  readonly maturity: DigitalMaturity;
  /** Fonctions déclarées présentes dans l'entreprise. */
  readonly functions: readonly BusinessFunction[];
  /** Volumes collectés. Une clé absente = grandeur non mesurée. */
  readonly volumes: Partial<Record<VolumeKey, number>>;
  /** Coût horaire chargé moyen. Défaut si non réglé par l'utilisateur. */
  readonly hourlyCostEur?: number;
}

/** Résultat chiffré pour une tâche du référentiel. */
export interface TaskResult {
  readonly task: AutomatableTask;
  /** Volume annualisé effectivement retenu. */
  readonly annualVolume: number;
  /** Temps unitaire après ajustement sectoriel, en minutes. */
  readonly minutesPerUnit: number;
  /** Heures passées aujourd'hui sur cette tâche, sur l'année, toute l'équipe. */
  readonly currentHoursPerYear: number;
  /** Heures récupérables — valeur centrale. */
  readonly savedHoursPerYear: number;
  /** Fourchette basse / haute, dérivée de `confidence`. */
  readonly savedHoursLow: number;
  readonly savedHoursHigh: number;
  readonly savedEurPerYear: number;
  /** Délai avant premier gain, pénalité de maturité comprise. */
  readonly weeksToValue: number;
  /** Score de priorité — sert au classement du plan d'action. */
  readonly priorityScore: number;
}

/** Agrégat par fonction, pour la ventilation du rapport. */
export interface FunctionResult {
  readonly fn: BusinessFunction;
  readonly savedHoursPerYear: number;
  readonly savedEurPerYear: number;
  readonly sharePct: number;
  readonly taskCount: number;
}

/** Une vague de la feuille de route. */
export interface RoadmapWave {
  readonly id: "wave1" | "wave2" | "wave3";
  readonly labelFr: string;
  readonly horizonFr: string;
  readonly taskIds: readonly string[];
  readonly savedHoursPerYear: number;
  readonly savedEurPerYear: number;
}

/** Le rapport complet. C'est l'objet rendu à l'écran, en PDF, et par email. */
export interface RoiReport {
  readonly answers: RoiAnswers;
  readonly hourlyCostEur: number;
  readonly headcount: number;
  /** Toutes les tâches retenues, classées par score de priorité décroissant. */
  readonly tasks: readonly TaskResult[];
  /** Les `topTasksInReport` premières — le plan d'action. */
  readonly topTasks: readonly TaskResult[];
  readonly byFunction: readonly FunctionResult[];
  readonly roadmap: readonly RoadmapWave[];
  readonly nonAutomatable: readonly NonAutomatableTask[];
  // ── Totaux ──
  readonly totalCurrentHoursPerYear: number;
  readonly totalSavedHoursPerYear: number;
  readonly totalSavedHoursLow: number;
  readonly totalSavedHoursHigh: number;
  readonly totalSavedEurPerYear: number;
  readonly totalSavedEurLow: number;
  readonly totalSavedEurHigh: number;
  /** Équivalents temps plein récupérés sur l'année. */
  readonly fteRecovered: number;
  /** Jours ouvrés libérés par mois sur l'ensemble de l'équipe. */
  readonly daysFreedPerMonth: number;
  /** Part du temps de l'équipe rendue, en % — borne le discours à du crédible. */
  readonly pctOfTeamCapacity: number;
  // ── Honnêteté ──
  /** Fonctions déclarées présentes mais dont aucun volume n'a été renseigné. */
  readonly unmeasuredFunctions: readonly BusinessFunction[];
  /** True si aucune tâche n'a pu être chiffrée — le rapport doit le dire franchement. */
  readonly isEmpty: boolean;
  /**
   * True si le garde-fou de capacité a dû réduire les gains (cf.
   * `CAPACITY_GUARD_SHARE`). Signale que les volumes déclarés sont élevés au
   * regard de l'effectif : le rapport le dit et invite à vérifier l'effectif.
   */
  readonly capacityCapped: boolean;
}

/**
 * Part maximale de la capacité annuelle de l'équipe que les tâches du
 * référentiel peuvent représenter.
 *
 * Sans ce garde-fou, un dirigeant de trois personnes cochant les tranches
 * hautes obtiendrait « 9 ETP récupérés » — un résultat arithmétiquement correct
 * et manifestement faux, qui détruirait la crédibilité de tout le rapport en
 * une ligne. 60 % est déjà généreux : le reste de la journée part dans le métier
 * lui-même, les déplacements, les imprévus et les réunions.
 */
export const CAPACITY_GUARD_SHARE = 0.6;

/** Pondération du score de priorité par niveau de confiance. */
export const CONFIDENCE_WEIGHT: Readonly<Record<TaskConfidence, number>> = {
  haute: 1,
  moyenne: 0.85,
  prudente: 0.7,
};
