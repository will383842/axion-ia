/**
 * Heures par semaine d'après les temps DÉCLARÉS (PUR). Ce sont des maxima tirés de leurs chiffres,
 * jamais une promesse : le calcul n'a lieu que si l'occurrence ET la durée sont présentes.
 */

import type { TempsDeclare } from "../../base-audit-schema";

const JOURS_OUVRES_PAR_SEMAINE = 5;
const SEMAINES_PAR_MOIS = 4.33;

/** Arrondi à 0,5 h ; une durée non nulle ne tombe jamais à 0. */
function arrondirDemiHeure(h: number): number {
  const r = Math.round(h * 2) / 2;
  return h > 0 && r === 0 ? 0.5 : r;
}

/** Minutes par semaine d'UNE ligne de temps, ou `null` si une donnée manque. */
export function minutesParSemaine(t: TempsDeclare): number | null {
  const duree = t.minutesMax ?? t.minutesMin;
  if (t.occurrences === null || t.periode === null || duree === null) return null;
  const parSemaine =
    t.periode === "jour"
      ? t.occurrences * JOURS_OUVRES_PAR_SEMAINE
      : t.periode === "semaine"
        ? t.occurrences
        : t.occurrences / SEMAINES_PAR_MOIS;
  return parSemaine * duree;
}

/**
 * Total des lignes calculables, en heures par semaine arrondies à 0,5 ; `null` si AUCUNE ligne
 * n'est calculable (« Non chiffré »).
 */
export function heuresParSemaine(temps: ReadonlyArray<TempsDeclare>): number | null {
  const calculables = temps.map(minutesParSemaine).filter((m): m is number => m !== null);
  if (calculables.length === 0) return null;
  return arrondirDemiHeure(calculables.reduce((s, m) => s + m, 0) / 60);
}

export const NON_CHIFFRE = "Non chiffré";

/** « 7,5 h / sem. » ou « Non chiffré ». */
export function libelleHeures(h: number | null): string {
  return h === null ? NON_CHIFFRE : `${h.toLocaleString("fr-FR")} h / sem.`;
}
