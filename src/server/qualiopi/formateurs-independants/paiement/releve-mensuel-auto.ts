/**
 * Relevé mensuel préparé seul (lot L12m, décision 98), pur.
 *
 * Le 1er de chaque mois, le BROUILLON du relevé du mois écoulé peut être calculé
 * seul (salariés, et indépendants avant la bascule) ; la VALIDATION reste à Will.
 * Une alerte part si, N jours après le 1er, un relevé du mois écoulé n'est
 * toujours pas validé.
 *
 * 🔴 Non branché : la décision 98 n'est pas arrêtée et aucun interrupteur ne
 * porte encore ce passage. Ces fonctions disent QUOI faire, à QUELLE date ;
 * elles ne lancent rien.
 */

import {
  PARAMETRES_ARGENT_FORMATEURS,
  type ParametresArgentFormateurs,
} from "../argent/parametres";
import { jourParis } from "../argent/dates";

export interface PeriodeMois {
  readonly year: number;
  readonly month: number;
}

/** Le mois écoulé, si l'on est le 1er du mois (heure de Paris) ; sinon `null`. */
export function brouillonMensuelAPreparer(maintenant: Date): PeriodeMois | null {
  const j = jourParis(maintenant);
  if (!j.endsWith("-01")) return null;
  const [y, m] = j.split("-").map(Number) as [number, number];
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

const VALIDES = new Set(["valide", "facture_recue", "paye", "annule"]);

/**
 * Alerte « relevé du mois non validé » : à partir du 1er + N jours, s'il reste
 * au moins un relevé du mois écoulé en brouillon ou à valider.
 */
export function alerteReleveNonValide(
  maintenant: Date,
  statutsDuMoisEcoule: ReadonlyArray<string>,
  p: Pick<ParametresArgentFormateurs, "releveMensuelAlerteJours"> = PARAMETRES_ARGENT_FORMATEURS,
): boolean {
  const jour = Number(jourParis(maintenant).slice(8, 10));
  if (jour < 1 + p.releveMensuelAlerteJours) return false;
  return statutsDuMoisEcoule.some((s) => !VALIDES.has(s));
}
