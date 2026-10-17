/**
 * CHANTIER QNC, LOT L02 — QUAND UNE SESSION D'ESSAI PEUT-ELLE NAÎTRE ?
 *
 * PURE. L'interrupteur `qualiopi.essai.actif` gouverne la CRÉATION des essais :
 *   - `eteint` (défaut, clé absente) : aucune session d'essai ne se crée ;
 *   - `essai` ou `actif` : la case « session d'essai » est offerte.
 * (En `essai`, un lot n'agit que sur le banc d'essai ; créer un essai EST agir
 * sur le banc d'essai, les deux positions ouvrent donc la même porte.)
 *
 * Deux refus de plus, pour que l'essai ne touche rien de réel :
 *   - pas de devis : le rattachement fait passer un vrai devis commercial à
 *     « transformé » et lie une convention d'essai à un prix réel ;
 *   - pas de récurrence : les occurrences partagent la série du parent, et une
 *     suite d'essais n'a rien à démontrer qu'un essai seul ne montre pas.
 */

import type { EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";

export function creationEssaiOuverte(etat: EtatInterrupteur): boolean {
  return etat !== "eteint";
}

/** Le motif du refus, ou `null` si la session d'essai peut naître. */
export function refusSessionDEssai(e: {
  readonly etat: EtatInterrupteur;
  readonly devisId: string | null;
  readonly recurrence: number | null;
}): string | null {
  if (!creationEssaiOuverte(e.etat)) {
    return "Le mode essai est éteint : aucune session d'essai ne peut être créée.";
  }
  if (e.devisId !== null) {
    return "Une session d'essai ne se rattache à aucun devis : elle ne doit toucher aucune pièce commerciale réelle.";
  }
  if (e.recurrence !== null) {
    return "Une session d'essai ne se crée pas en série : créez-la seule.";
  }
  return null;
}
