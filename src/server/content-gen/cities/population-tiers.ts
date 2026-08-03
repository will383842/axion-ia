/**
 * Paliers de population des villes — SOURCE UNIQUE des seuils ET de leur nom.
 *
 * 🔴 DEUX ÉCRANS ANNONÇAIENT DES SEUILS FAUX. Le filtre « palier » de la
 * couverture des villes et celui de la file de génération proposaient
 * « T1 (> 500k) / T2 (100-500k) / T3 (20-100k) / T4 (< 20k) ». Or le classement
 * réel commence à 100 000 habitants pour T1 : filtrer sur « T1 (> 500k) »
 * ramenait Grenoble, Metz, Perpignan… et l'écran passait pour cassé alors qu'il
 * disait vrai — c'est son étiquette qui mentait. Deux autres écrans
 * (couverture par palier, couverture par type de contenu) affichaient les bons
 * seuils : la même donnée se décrivait de deux façons contradictoires selon la
 * page ouverte.
 *
 * Le seuil et sa description vivent donc désormais côte à côte, dans un module
 * PUR — importable par un composant client, ce que `city-universe-sync.ts` ne
 * pouvait pas offrir (il ouvre Prisma).
 */

/** Palier de population d'une ville, de 1 (le plus peuplé) à 4. */
export function populationTier(pop: number): number {
  if (pop >= 100_000) return 1;
  if (pop >= 20_000) return 2;
  if (pop >= 10_000) return 3;
  return 4;
}

/** Bornes lisibles de chaque palier. Dérivées des seuils juste au-dessus. */
export const PALIER_LABELS: Record<number, string> = {
  1: "≥ 100 000 hab.",
  2: "20 000 à 100 000 hab.",
  3: "10 000 à 20 000 hab.",
  4: "moins de 10 000 hab.",
};

/** Libellé complet d'un palier, forme « T1 — ≥ 100 000 hab. ». */
export function palierLabel(tier: number): string {
  const bornes = PALIER_LABELS[tier];
  return bornes === undefined ? `T${tier}` : `T${tier} — ${bornes}`;
}
