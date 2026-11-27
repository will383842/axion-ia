// S6-1 — « Villes principales » d'une page région : uniquement des pages INDEXÉES.
//
// Avant : filtre « a un copy », vrai pour les 2 157 communes, donc la liste
// mêlait pages indexées et pages `noindex`. Aucune ville n'est complétée par
// une page non indexée : une région sans ville indexée n'affiche pas la liste.
// Pur, sans import du barrel de contenu.

import { VILLES_INDEXEES } from "@/content/villes/villes-indexees";

/** Les `n` villes indexées les plus peuplées de la liste (ordre de population décroissant). */
export function villesPrincipalesIndexees<T extends { slug: string; population: number }>(
  villes: ReadonlyArray<T>,
  n: number,
): T[] {
  return villes
    .filter((v) => VILLES_INDEXEES.has(v.slug))
    .sort((a, b) => b.population - a.population)
    .slice(0, n);
}
