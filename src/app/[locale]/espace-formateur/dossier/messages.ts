/**
 * « Mon dossier » — les issues d'un dépôt, par CODE FERMÉ (lot E, M13).
 *
 * L'action ne renvoie dans l'adresse qu'un code de cette liste ; la page n'affiche que
 * le texte qui lui correspond. Un message inconnu retombe sur « erreur ».
 */

import { MESSAGES_DEPOT } from "@/server/pieces/depot-controle";
import { MESSAGES_CHANGEMENT } from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { MESSAGES_DEPOT_FORMATEUR } from "@/server/qualiopi/formateurs-independants/depot";
import { MESSAGES_MON_DOSSIER } from "@/server/qualiopi/formateurs-independants/mon-dossier";
import { MESSAGES_NDA_ESPACE } from "@/server/qualiopi/formateurs-independants/numero-declaration-espace";

export const ISSUES_DEPOT = {
  recu: "Pièce reçue, merci. Nous la vérifions et revenons vers vous si quelque chose ne va pas.",
  fichier: "Choisissez un fichier.",
  demande:
    "Demande enregistrée, merci. Elle sera vérifiée par notre équipe, au plus tôt dans 48 heures ; un e-mail vous la confirme.",
  ...MESSAGES_DEPOT,
  ...MESSAGES_DEPOT_FORMATEUR,
  ...MESSAGES_MON_DOSSIER,
  // V1-A-10 — le numéro de déclaration d'activité (codes préfixés `nda_`).
  ...MESSAGES_NDA_ESPACE,
  // Préfixés : « erreur » et « indisponible » existent aussi pour le dépôt.
  changement_indisponible: MESSAGES_CHANGEMENT.indisponible,
  changement_ibanInvalide: MESSAGES_CHANGEMENT.ibanInvalide,
  changement_identique: MESSAGES_CHANGEMENT.identique,
  changement_adresseInvalide: MESSAGES_CHANGEMENT.adresseInvalide,
  changement_dejaEnCours: MESSAGES_CHANGEMENT.dejaEnCours,
  changement_erreur: MESSAGES_CHANGEMENT.erreur,
} as const;

export type CodeIssueDepot = keyof typeof ISSUES_DEPOT;

export function codeDuMessage(message: string, defaut: CodeIssueDepot = "erreur"): CodeIssueDepot {
  const trouve = (Object.keys(ISSUES_DEPOT) as CodeIssueDepot[]).find(
    (k) => ISSUES_DEPOT[k] === message,
  );
  return trouve ?? defaut;
}

export function messageDuCode(code: unknown): { texte: string; ok: boolean } | null {
  if (typeof code !== "string" || !Object.prototype.hasOwnProperty.call(ISSUES_DEPOT, code)) {
    return null;
  }
  return {
    texte: ISSUES_DEPOT[code as CodeIssueDepot],
    ok: code === "recu" || code === "demande" || code === "nda_recu",
  };
}
