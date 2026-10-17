/**
 * 🔴 CHANTIER QNC, LOT L11 — L'INTERRUPTEUR `qualiopi.dossier_session.actif`.
 *
 * Calque du socle (`socle/interrupteurs.ts`) : clé ABSENTE = éteint, `essai` =
 * seulement les sessions (ou inscriptions) du banc d'essai, `actif` = toutes.
 * Les bascules passent par `basculerInterrupteurQualiopi`, qui les journalise
 * dans `activity_logs`. La clé n'est PAS dans `QUALIOPI_CONFIG_REGISTRY`.
 *
 * Ce qui est derrière l'interrupteur (comportement qui change) :
 *   · le dossier complet du ZIP (`dossier-complet/`) et les originaux
 *     remplacés joints et étiquetés ;
 *   · la réserve « référent handicap » sur le bloc d'adaptation de l'index ;
 *   · la copie des e-mails de formation GARDÉE (adresse masquée) à
 *     l'effacement RGPD, et la copie en création seule ;
 *   · les mesures d'adaptation sur la fiche formateur.
 *
 * Ce qui est livré allumé (lecture seule) : les onglets « Dossier » et
 * « E-mails » de la fiche session — ils lisent le même rendu que le ZIP, et
 * disent, quand l'interrupteur est éteint, que le ZIP ne le porte pas encore.
 */

import {
  estActifPour,
  lireInterrupteurQualiopi,
  type EtatInterrupteur,
} from "@/server/qualiopi/socle/interrupteurs";

export const LOT_DOSSIER_SESSION = "dossier_session" as const;

/** L'état de l'interrupteur du lot. Ne lève jamais (éteint par défaut). */
export function lireEtatDossierSession(
  client?: Parameters<typeof lireInterrupteurQualiopi>[1],
): Promise<EtatInterrupteur> {
  return lireInterrupteurQualiopi(LOT_DOSSIER_SESSION, client);
}

/**
 * Le lot agit-il sur cette cible ? En `essai`, seulement si elle est du banc
 * d'essai. La cible est la SESSION pour le dossier et la fiche formateur
 * (une inscription d'essai n'allume pas le dossier d'une session réelle) ;
 * pour une copie d'e-mail, la session OU l'inscription que l'envoi visait.
 */
export function dossierCompletActifPour(
  etat: EtatInterrupteur,
  cible: { readonly estTestInterne: boolean } | null,
): boolean {
  return estActifPour(etat, cible);
}
