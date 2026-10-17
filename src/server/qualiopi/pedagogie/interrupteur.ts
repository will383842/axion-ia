/**
 * Lot L08 — l'interrupteur `qualiopi.pedagogie.actif` (mécanisme du socle L00).
 *
 * Éteint : tout ce que le lot ajoute est inerte, le code se comporte comme avant.
 * Essai : le lot n'agit que sur une session ou une inscription `estTestInterne`.
 */

import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_PEDAGOGIE = "pedagogie";

export function lirePedagogie(): Promise<EtatInterrupteur> {
  return lireInterrupteurQualiopi(LOT_PEDAGOGIE);
}

/** Le lot agit-il sur cette cible ? `null` : traitement qui ne porte sur aucune session. */
export async function pedagogieActivePour(
  cible: { readonly estTestInterne: boolean } | null,
): Promise<boolean> {
  return estActifPour(await lirePedagogie(), cible);
}
