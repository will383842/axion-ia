/**
 * Nom de l'organisme tiers tel qu'une alerte INTERNE le lit (fiche L11-S2).
 *
 * `nomOpcoDuClient` rend un repli (`NOM_OPCO_A_PRECISER`) quand la fiche client ne dit rien :
 * utile sur une facture, mais il porte un mot de vocabulaire interne et une consigne de saisie.
 * Une alerte écrit à la place une phrase neutre ; un nom reconnu est rendu tel quel.
 */

import { NOM_OPCO_A_PRECISER } from "@/server/qualiopi/financements/opco-referentiel";

export const ORGANISME_TIERS_NON_RENSEIGNE =
  "l'organisme tiers (non renseigné sur la fiche client)";

export function nomTiersLisible(nom: string): string {
  return nom === NOM_OPCO_A_PRECISER ? ORGANISME_TIERS_NON_RENSEIGNE : nom;
}
