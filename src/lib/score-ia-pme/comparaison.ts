// Score IA TPE-PME — situer un score dans une répartition en tranches (plan V2-10 §5.1).
// Module PUR : le navigateur calcule « environ X % ont un score inférieur au vôtre » à partir des
// pourcentages par tranche déjà présents dans la page. Aucun effectif par tranche n'existe.

import { tranche } from "./formule";

export interface SegmentComparaison {
  readonly n: number;
  /** 10 pourcentages entiers, tranches 0-9 … 90-100. */
  readonly pctParTranche: readonly number[];
}

/** Somme des tranches inférieures + moitié de la tranche du score, arrondie à 5 près. */
export function pourcentageInferieur(segment: SegmentComparaison, score: number): number {
  const t = tranche(score);
  let somme = 0;
  for (let i = 0; i < t; i += 1) somme += segment.pctParTranche[i] ?? 0;
  somme += (segment.pctParTranche[t] ?? 0) / 2;
  return Math.min(100, Math.max(0, Math.round(somme / 5) * 5));
}
