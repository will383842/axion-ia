/**
 * États du circuit visio — SOURCE UNIQUE (chantier visio, ADR 0054).
 *
 * `ETATS_ENREGISTREMENT_ACTIFS` décide à la fois :
 *   · ce que le code considère comme un enregistrement « en vie » ;
 *   · l'index partiel `enregistrements_un_actif` de la migration
 *     (`prisma/objets-sql-bruts.ts` en produit le SQL à partir d'ici).
 *
 * Un état ajouté ici sans migration, ou l'inverse, fait rougir
 * `tests/unit/ci/l-index-un-enregistrement-actif-suit-la-constante.spec.ts` :
 * sans cette garde, la base laisserait passer deux enregistrements « actifs »
 * sur la même rencontre, ou en refuserait un légitime.
 *
 * Ce module est PUR (aucun import d'exécution) : il est lu par le site, par le
 * worker et par les scripts de la CI.
 */

import type { EnregistrementStatut } from "../../../prisma/generated/client";

/** Un seul enregistrement dans ces états par rencontre (index partiel unique). */
export const ETATS_ENREGISTREMENT_ACTIFS = [
  "accord_en_attente",
  "en_cours",
  "interrompu",
] as const satisfies readonly EnregistrementStatut[];

export type EtatEnregistrementActif = (typeof ETATS_ENREGISTREMENT_ACTIFS)[number];

/** Vrai si l'enregistrement occupe la place unique de sa rencontre. */
export function estEnregistrementActif(statut: EnregistrementStatut): boolean {
  return (ETATS_ENREGISTREMENT_ACTIFS as readonly string[]).includes(statut);
}
