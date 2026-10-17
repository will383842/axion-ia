/**
 * Qualiopi ind. 27 — les ÉCARTS d'un contrôle à preuves (contrôle de chaque mission,
 * revue complète annuelle), en règles PURES.
 *
 * - Chaque preuve attendue (`controles.config.ts`) est cochée ou non : une preuve non
 *   cochée est un écart, de la gravité que la configuration lui donne.
 * - Un écart MAJEUR suspend le sous-traitant (la garde de mission refuse ses nouvelles
 *   missions) jusqu'à une levée motivée en console.
 * - Un écart MINEUR ouvre un plan de correction, échéance J+`delaiCorrectionJours`
 *   (réglage), et une alerte part à l'échéance s'il n'est pas corrigé.
 *
 * Aucun import Prisma ni Next.
 */

import {
  REGLAGES_IND27_DEFAUTS,
  type GraviteEcart,
  type PreuveAttendue,
  type ReglagesInd27,
} from "./controles.config";
import type { ResultatControle } from "./regles";

const JOUR_MS = 24 * 3600 * 1000;

export interface PreuveConstatee {
  readonly code: string;
  readonly libelle: string;
  readonly gravite: GraviteEcart;
  readonly fournie: boolean;
}

export interface Constat {
  readonly preuves: ReadonlyArray<PreuveConstatee>;
  readonly majeurs: ReadonlyArray<PreuveConstatee>;
  readonly mineurs: ReadonlyArray<PreuveConstatee>;
  /** Conforme : rien ne manque. Non conforme : un écart majeur. À revoir : mineurs seuls. */
  readonly resultat: ResultatControle;
}

/** Le constat d'une liste cochée. Un code coché inconnu de la liste est ignoré. */
export function constaterPreuves(
  liste: ReadonlyArray<PreuveAttendue>,
  cochees: ReadonlyArray<string>,
): Constat {
  const fournies = new Set(cochees);
  const preuves = liste.map((p): PreuveConstatee => ({
    code: p.code,
    libelle: p.libelle,
    gravite: p.gravite,
    fournie: fournies.has(p.code),
  }));
  const majeurs = preuves.filter((p) => !p.fournie && p.gravite === "majeur");
  const mineurs = preuves.filter((p) => !p.fournie && p.gravite === "mineur");
  return {
    preuves,
    majeurs,
    mineurs,
    resultat: majeurs.length > 0 ? "non_conforme" : mineurs.length > 0 ? "a_revoir" : "conforme",
  };
}

/** L'échéance d'un plan de correction : J+`delaiCorrectionJours` après le constat. */
export function echeanceCorrection(constateAt: Date, reglages: ReglagesInd27): Date {
  return new Date(constateAt.getTime() + reglages.delaiCorrectionJours * JOUR_MS);
}

/** Bornes d'un réglage lisible ; hors bornes ou illisible : le défaut. */
const BORNES = {
  delaiCorrectionJours: [1, 365],
  revueCompleteMois: [1, 36],
} as const satisfies Record<keyof ReglagesInd27, readonly [number, number]>;

function borne(k: keyof ReglagesInd27, v: unknown): number {
  const [min, max] = BORNES[k];
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
    ? v
    : REGLAGES_IND27_DEFAUTS[k];
}

/** Les réglages lus, ramenés au défaut s'ils sont illisibles ou hors bornes. */
export function reglagesInd27(lus: {
  readonly delaiCorrectionJours: unknown;
  readonly revueCompleteMois: unknown;
}): ReglagesInd27 {
  return {
    delaiCorrectionJours: borne("delaiCorrectionJours", lus.delaiCorrectionJours),
    revueCompleteMois: borne("revueCompleteMois", lus.revueCompleteMois),
  };
}

export interface CorrectionLue {
  readonly libelle: string;
  readonly echeance: Date;
  readonly corrigeAt: Date | null;
}

/** Les plans de correction ouverts dont l'échéance est passée. */
export function correctionsEchues(
  corrections: ReadonlyArray<CorrectionLue>,
  maintenant: Date,
): ReadonlyArray<{ readonly libelle: string; readonly echeance: Date }> {
  return corrections
    .filter((c) => c.corrigeAt === null && c.echeance.getTime() <= maintenant.getTime())
    .map((c) => ({ libelle: c.libelle, echeance: c.echeance }));
}
