// Formule du Score IA TPE-PME — module PUR (aucun import serveur, aucun Zod).
// Importé à la fois par le composant client et par le calcul du snapshot :
// le score affiché au dirigeant et celui des autres répondants sortent du même code.

import { SCORE_VERSION } from "./constantes";

export { SCORE_VERSION };

export type CritereId =
  | "maturityLevel"
  | "hasStrategy"
  | "useCases"
  | "teamTrained"
  | "timeSavedPerDay"
  | "annualBudget"
  | "tools";

/** Poids des critères (total 100). */
export const POIDS: Readonly<Record<CritereId, number>> = {
  maturityLevel: 30,
  hasStrategy: 15,
  useCases: 15,
  teamTrained: 15,
  timeSavedPerDay: 10,
  annualBudget: 10,
  tools: 5,
};

/** Barèmes (points de 0 à 100) des critères à réponse unique. */
export const BAREMES = {
  maturityLevel: { none: 0, exploration: 25, poc: 50, production: 75, scaled: 100 },
  hasStrategy: { none: 0, in_progress: 50, formalized: 100 },
  teamTrained: { none: 0, informal: 50, formal: 100 },
  timeSavedPerDay: { none: 0, lt_30min: 20, m30_1h: 40, h1_2: 60, h2_3: 80, gt_3h: 100 },
  // « dont_know » : critère retiré (absent du barème, géré à part).
  annualBudget: { zero: 0, lt_1k: 20, k1_5: 40, k5_20: 60, k20_100: 80, gt_100k: 100 },
} as const satisfies Record<string, Record<string, number>>;

/** Points selon le nombre d'usages (hors « none ») : 0 / 1 / 2 / 3 et plus. */
const POINTS_USAGES = [0, 33, 67, 100] as const;
/** Points selon le nombre d'outils (hors « none ») : 0 / 1 / 2 et plus. */
const POINTS_OUTILS = [0, 50, 100] as const;

export interface ReponsesScore {
  maturityLevel: string;
  hasStrategy: string;
  useCases: readonly string[];
  teamTrained: string;
  timeSavedPerDay: string;
  annualBudget: string;
  tools: readonly string[];
}

export interface DetailCritere {
  critere: CritereId;
  /** Points obtenus sur ce critère (poids × barème / 100). */
  obtenus: number;
  /** Points possibles (le poids). */
  possibles: number;
}

export type NiveauScore = "Découverte" | "Premiers essais" | "En production" | "Structurée";

export interface ResultatScore {
  score: number;
  niveau: NiveauScore;
  detail: DetailCritere[];
}

function lire<K extends keyof typeof BAREMES>(critere: K, valeur: string): number {
  const bareme = BAREMES[critere] as Record<string, number>;
  if (!Object.prototype.hasOwnProperty.call(bareme, valeur)) {
    throw new Error(`Score IA : valeur inconnue pour ${critere}`);
  }
  return bareme[valeur] ?? 0;
}

/** Nombre de choix réels : « none » est exclusif et ne compte pas. */
function compter(valeurs: readonly string[]): number {
  return new Set(valeurs.filter((v) => v !== "none")).size;
}

export function niveauDe(score: number): NiveauScore {
  if (score < 25) return "Découverte";
  if (score < 50) return "Premiers essais";
  if (score < 75) return "En production";
  return "Structurée";
}

/** score = arrondi( Σ(points_i × poids_i) / Σ poids_i ), i = critères présents. */
export function calculerScore(r: ReponsesScore): ResultatScore {
  const lignes: Array<{ critere: CritereId; points: number }> = [
    { critere: "maturityLevel", points: lire("maturityLevel", r.maturityLevel) },
    { critere: "hasStrategy", points: lire("hasStrategy", r.hasStrategy) },
    { critere: "useCases", points: POINTS_USAGES[Math.min(compter(r.useCases), 3)] ?? 0 },
    { critere: "teamTrained", points: lire("teamTrained", r.teamTrained) },
    { critere: "timeSavedPerDay", points: lire("timeSavedPerDay", r.timeSavedPerDay) },
  ];
  if (r.annualBudget !== "dont_know") {
    lignes.push({ critere: "annualBudget", points: lire("annualBudget", r.annualBudget) });
  }
  lignes.push({ critere: "tools", points: POINTS_OUTILS[Math.min(compter(r.tools), 2)] ?? 0 });

  let somme = 0;
  let poids = 0;
  const detail: DetailCritere[] = [];
  for (const l of lignes) {
    const w = POIDS[l.critere];
    somme += l.points * w;
    poids += w;
    detail.push({ critere: l.critere, obtenus: (l.points * w) / 100, possibles: w });
  }
  const score = Math.round(somme / poids);
  return { score, niveau: niveauDe(score), detail };
}

/** Tranche de 10 points : 0 (0-9) … 9 (90-100). */
export function tranche(score: number): number {
  return Math.min(Math.max(Math.floor(score / 10), 0), 9);
}
