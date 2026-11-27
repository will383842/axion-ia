/** Note de la porte (§ 4.3) : `100 − P_avertissements − P_preuves − P_proximité − P_intention`. */

import type { PenalitesNote } from "./types";

export const MAX_PENALITES = Object.freeze({
  avertissements: 54,
  preuves: 16,
  proximite: 10,
  intention: 6,
});

/**
 * `undefined` = critère pas encore branché : 0 point. Une valeur NON FINIE (NaN,
 * Infinity) est une mesure cassée : `null` n'est pas 0, elle compte au maximum.
 */
const borne = (v: number | undefined, max: number): number => {
  if (v === undefined) return 0;
  if (typeof v !== "number" || !Number.isFinite(v)) return max;
  return Math.min(Math.max(v, 0), max);
};

export function calculerNote(p: PenalitesNote): number {
  const total =
    borne(p.avertissements, MAX_PENALITES.avertissements) +
    borne(p.preuves, MAX_PENALITES.preuves) +
    borne(p.proximite, MAX_PENALITES.proximite) +
    borne(p.intention, MAX_PENALITES.intention);
  return 100 - total;
}
