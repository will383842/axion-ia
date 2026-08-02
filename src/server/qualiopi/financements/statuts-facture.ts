/**
 * Qualiopi — SOURCE UNIQUE des statuts de facture « ouverte ».
 *
 * Une facture OUVERTE est une facture **émise et non soldée**, quel que soit le
 * palier de retard atteint. `en_retard` n'est pas une catégorie à part : c'est
 * le même argent dû, avec une étiquette d'ancienneté posée par le cron de
 * 06:30 UTC (`handleFacturesRetard`). Une liste qui omet `en_retard` ne
 * « filtre » donc pas — elle devient VIDE au lendemain de chaque échéance.
 *
 * C'est exactement ce qui s'était produit à trois endroits indépendants :
 *   - `alertes/evaluateur.ts` (règle impayés) ne voyait plus aucune facture,
 *     le cron d'alertes de 07:00 UTC passant APRÈS celui qui bascule le statut ;
 *   - `previsionnel/calcul.ts` ne comptait que `emise` → « Encaissements
 *     attendus » et « Impayés » tombaient à zéro ;
 *   - chaque écran redéclarait sa propre liste, silencieusement divergeable.
 *
 * Toute nouvelle lecture de créance DOIT partir d'ici. Les filtres qui incluent
 * `payee` (chiffre d'affaires émis, « la session est-elle facturée ? ») sont
 * VOLONTAIREMENT différents : ils répondent à une autre question et ne doivent
 * PAS être remplacés par cette constante.
 *
 * Module PUR : aucun accès Prisma, seulement le TYPE de l'enum (import type,
 * effacé à la compilation) — importable par un worker, un script ou un test.
 */

import type { FactureFormationStatut } from "../../../../prisma/generated/client";

/**
 * Statuts d'une facture ouverte (émise, non soldée, non annulée).
 *
 * Typé sur l'enum Prisma : renommer une valeur au schéma casse la compilation
 * ici plutôt que de rendre un filtre silencieusement vide en production.
 */
export const STATUTS_FACTURE_OUVERTE = [
  "emise",
  "partiellement_payee",
  "en_retard",
] as const satisfies readonly FactureFormationStatut[];

/** Type des statuts ouverts (sous-ensemble de `FactureFormationStatut`). */
export type StatutFactureOuverte = (typeof STATUTS_FACTURE_OUVERTE)[number];

/** Index O(1) — construit une fois, jamais recréé dans une boucle de rendu. */
const OUVERTS: ReadonlySet<string> = new Set(STATUTS_FACTURE_OUVERTE);

/**
 * Vrai si le statut désigne une facture ouverte (émise et non soldée).
 *
 * Accepte `string` volontairement : les appelants lisent souvent un statut
 * élargi (`FactureFormationStatut` complet, ou une chaîne issue d'un type
 * miroir), et un `as` de confort au point d'appel annulerait la garde.
 */
export function estFactureOuverte(statut: string): boolean {
  return OUVERTS.has(statut);
}
