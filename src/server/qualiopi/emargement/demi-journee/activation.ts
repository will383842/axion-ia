/**
 * Chantier QNC, lot L06 — l'interrupteur `qualiopi.emargement.actif`.
 *
 * Une seule question, posée partout de la même façon : l'émargement par
 * demi-journée agit-il sur CETTE session ? `eteint` (clé absente, défaut) = le
 * comportement d'avant, à l'identique ; `essai` = seulement sur une session du
 * banc d'essai (`estTestInterne`) ; `actif` = pour tous.
 *
 * Ne lève jamais : `lireInterrupteurQualiopi` rend `eteint` sur toute erreur de
 * lecture, et le build `stub.invalid` lit donc `eteint`.
 */

import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_EMARGEMENT = "emargement" as const;

export function lireInterrupteurEmargement(): Promise<EtatInterrupteur> {
  return lireInterrupteurQualiopi(LOT_EMARGEMENT);
}

/** L'émargement par demi-journée agit-il sur cette session ? */
export async function emargementParDemiJourneePour(session: {
  readonly estTestInterne?: boolean | null | undefined;
}): Promise<boolean> {
  const etat = await lireInterrupteurEmargement();
  return estActifPour(etat, { estTestInterne: session.estTestInterne === true });
}
