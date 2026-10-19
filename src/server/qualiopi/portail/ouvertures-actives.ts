/**
 * Chantier QNC, P11 — la règle pure d'« essai » des traces de l'espace stagiaire,
 * à part pour que `portail-service` et `ouvertures-espace` ne s'importent pas
 * l'un l'autre.
 */

import { estActifPour, type EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";

/** Pure : l'interrupteur agit-il pour un stagiaire dont voici les inscriptions ? */
export function ouverturesActives(
  etat: EtatInterrupteur,
  inscriptions: ReadonlyArray<{ readonly estTestInterne: boolean }>,
): boolean {
  if (etat === "eteint") return false;
  if (inscriptions.length === 0) return false;
  return estActifPour(etat, { estTestInterne: inscriptions.every((i) => i.estTestInterne) });
}
