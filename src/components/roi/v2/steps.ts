// Simulateur de gains v2 — construction du parcours.
//
// Pur, sans React : le parcours est une donnée dérivée des réponses, pas un
// état. Ainsi la même fonction sert au wizard, aux tests, et au calcul de la
// barre de progression — sans risque de divergence entre ce que l'utilisateur
// voit et ce que le moteur attend.
//
// Le parcours est ADAPTATIF : les quatre écrans de cadrage sont toujours
// posés, puis seules les questions de volume rattachées aux fonctions
// déclarées présentes s'ajoutent. Un artisan seul voit 8 écrans, un cabinet de
// quarante personnes en voit 16.

import {
  HEADCOUNT_BANDS,
  MATURITY_LEVELS,
  type BusinessFunction,
  type RoiAnswers,
  type VolumeKey,
} from "@/content/roi/model/types";
import { BUSINESS_FUNCTIONS } from "@/content/roi/model/functions";
import { selectVolumeQuestions } from "@/content/roi/model/questions";
import { CLIENT_SECTORS } from "@/content/sectors";

/** Une option affichée : un grand bouton, un appui, on avance. */
export interface StepOption {
  readonly id: string;
  readonly labelFr: string;
  /** Deuxième ligne, plus petite. Sert à lever une ambiguïté, jamais à vendre. */
  readonly hintFr?: string;
  /** Pastille de gauche (emoji sectoriel). Décoratif uniquement. */
  readonly emoji?: string;
}

interface StepBase {
  /** Identifiant stable — sert de clé React et d'ancre de progression. */
  readonly id: string;
  readonly titleFr: string;
  readonly hintFr?: string;
  readonly options: readonly StepOption[];
}

export interface SingleStep extends StepBase {
  readonly kind: "single";
  /** Quelle partie des réponses cet écran renseigne. */
  readonly field: "sector" | "headcount" | "maturity";
}

export interface MultiStep extends StepBase {
  readonly kind: "multi";
  readonly field: "functions";
  /** Nombre minimum de choix pour pouvoir continuer. */
  readonly minChoices: number;
}

export interface VolumeStep extends StepBase {
  readonly kind: "volume";
  readonly volumeKey: VolumeKey;
  readonly fn: BusinessFunction;
  /** Valeur associée à chaque option. `null` = « je ne sais pas ». */
  readonly values: Readonly<Record<string, number | null>>;
}

export type Step = SingleStep | MultiStep | VolumeStep;

// ---------------------------------------------------------------------------
// Écrans de cadrage — toujours posés, dans cet ordre
// ---------------------------------------------------------------------------

const SECTOR_STEP: SingleStep = {
  kind: "single",
  field: "sector",
  id: "sector",
  titleFr: "Dans quel secteur travaillez-vous ?",
  hintFr: "Le secteur détermine les tâches que nous allons examiner, et leur poids réel.",
  options: [
    ...CLIENT_SECTORS.map((s) => ({ id: s.slug, labelFr: s.labelFr, emoji: s.emoji })),
    { id: "generique", labelFr: "Un autre secteur", emoji: "🧭" },
  ],
};

const HEADCOUNT_STEP: SingleStep = {
  kind: "single",
  field: "headcount",
  id: "headcount",
  titleFr: "Combien êtes-vous dans l'entreprise ?",
  hintFr: "Toutes les personnes qui travaillent avec vous, y compris vous.",
  options: HEADCOUNT_BANDS.map((b) => ({ id: b.id, labelFr: b.labelFr })),
};

const MATURITY_STEP: SingleStep = {
  kind: "single",
  field: "maturity",
  id: "maturity",
  titleFr: "Où en êtes-vous côté outils ?",
  hintFr:
    "Cela ne change rien à votre potentiel, mais beaucoup au délai avant les premiers résultats.",
  options: MATURITY_LEVELS.map((m) => ({ id: m.id, labelFr: m.labelFr, hintFr: m.hintFr })),
};

const FUNCTIONS_STEP: MultiStep = {
  kind: "multi",
  field: "functions",
  id: "functions",
  titleFr: "Qu'est-ce qui vous prend du temps ?",
  hintFr: "Cochez tout ce qui existe chez vous. Les questions suivantes s'adapteront.",
  minChoices: 1,
  options: BUSINESS_FUNCTIONS.map((f) => ({
    id: f.id,
    labelFr: f.questionLabelFr,
    hintFr: f.hintFr,
  })),
};

export const FRAMING_STEPS: readonly Step[] = [
  SECTOR_STEP,
  HEADCOUNT_STEP,
  MATURITY_STEP,
  FUNCTIONS_STEP,
];

/** Index de l'écran qui choisit les fonctions — au-delà, le parcours varie. */
export const FUNCTIONS_STEP_INDEX = 3;

// ---------------------------------------------------------------------------
// Parcours complet
// ---------------------------------------------------------------------------

/**
 * Construit la liste des écrans à partir des fonctions déjà déclarées.
 *
 * Tant que l'utilisateur n'a coché aucune fonction, le parcours s'arrête après
 * l'écran des fonctions : on n'affiche pas une barre de progression qui
 * promettrait des écrans dont on ignore encore le nombre.
 */
export function buildSteps(functions: readonly BusinessFunction[]): readonly Step[] {
  const volumeSteps: VolumeStep[] = selectVolumeQuestions(functions).map((q) => ({
    kind: "volume",
    id: `volume:${q.volumeKey}`,
    volumeKey: q.volumeKey,
    fn: q.fn,
    titleFr: q.questionFr,
    hintFr: q.hintFr,
    options: q.choices.map((c) => ({ id: c.id, labelFr: c.labelFr })),
    values: Object.fromEntries(q.choices.map((c) => [c.id, c.value])),
  }));

  return [...FRAMING_STEPS, ...volumeSteps];
}

/**
 * Applique la réponse d'un écran au jeu de réponses.
 *
 * Retourne toujours un NOUVEL objet : le flux s'appuie sur l'égalité
 * référentielle pour déclencher le recalcul et la mise à jour de l'URL.
 */
export function applyStepAnswer(
  answers: RoiAnswers,
  step: Step,
  optionIds: readonly string[],
): RoiAnswers {
  if (step.kind === "single") {
    const id = optionIds[0];
    if (!id) return answers;
    if (step.field === "sector") return { ...answers, sector: id as RoiAnswers["sector"] };
    if (step.field === "headcount") return { ...answers, headcount: id as RoiAnswers["headcount"] };
    return { ...answers, maturity: id as RoiAnswers["maturity"] };
  }

  if (step.kind === "multi") {
    // On conserve l'ordre canonique des fonctions plutôt que l'ordre de clic :
    // il pilote l'ordre des questions suivantes, qui doit rester prévisible.
    const chosen = new Set(optionIds);
    const ordered = BUSINESS_FUNCTIONS.map((f) => f.id).filter((id) => chosen.has(id));
    return { ...answers, functions: ordered };
  }

  const value = step.values[optionIds[0] ?? ""];
  const volumes = { ...answers.volumes };
  if (value === null || value === undefined) {
    // « Je ne sais pas » : on RETIRE la grandeur. Une réponse antérieure ne doit
    // pas survivre à un changement d'avis, sinon le rapport chiffrerait une
    // tâche que l'utilisateur vient explicitement de déclarer non mesurable.
    delete volumes[step.volumeKey];
  } else {
    volumes[step.volumeKey] = value;
  }
  return { ...answers, volumes };
}

/** Les identifiants d'options actuellement sélectionnés sur un écran donné. */
export function selectedOptionIds(answers: RoiAnswers, step: Step): readonly string[] {
  if (step.kind === "single") {
    if (step.field === "sector") return [answers.sector];
    if (step.field === "headcount") return [answers.headcount];
    return [answers.maturity];
  }
  if (step.kind === "multi") return answers.functions;

  const current = answers.volumes[step.volumeKey];
  if (current === undefined) return [];
  const hit = Object.entries(step.values).find(([, v]) => v === current);
  return hit ? [hit[0]] : [];
}

/**
 * Premier écran dont la réponse manque — sert à reprendre un parcours
 * interrompu (rechargement de page, retour depuis un autre onglet) là où il
 * s'est arrêté plutôt qu'au début.
 */
export function firstUnansweredIndex(
  answers: RoiAnswers,
  steps: readonly Step[],
  answered: ReadonlySet<string>,
): number {
  const idx = steps.findIndex((s) => !answered.has(s.id));
  return idx === -1 ? steps.length : idx;
}
