/**
 * « Mon dossier » — les issues d'un dépôt, par CODE FERMÉ (lot E, M13).
 *
 * L'action ne renvoie dans l'adresse qu'un code de cette liste ; la page n'affiche que
 * le texte qui lui correspond. Un message inconnu retombe sur « erreur ».
 */

import { MESSAGES_DEPOT } from "@/server/pieces/depot-controle";
import { MESSAGES_DEPOT_FORMATEUR } from "@/server/qualiopi/formateurs-independants/depot";
import { MESSAGES_MON_DOSSIER } from "@/server/qualiopi/formateurs-independants/mon-dossier";

export const ISSUES_DEPOT = {
  recu: "Pièce reçue, merci. Nous la vérifions et revenons vers vous si quelque chose ne va pas.",
  fichier: "Choisissez un fichier.",
  ...MESSAGES_DEPOT,
  ...MESSAGES_DEPOT_FORMATEUR,
  ...MESSAGES_MON_DOSSIER,
} as const;

export type CodeIssueDepot = keyof typeof ISSUES_DEPOT;

export function codeDuMessage(message: string): CodeIssueDepot {
  const trouve = (Object.keys(ISSUES_DEPOT) as CodeIssueDepot[]).find(
    (k) => ISSUES_DEPOT[k] === message,
  );
  return trouve ?? "erreur";
}

export function messageDuCode(code: unknown): { texte: string; ok: boolean } | null {
  if (typeof code !== "string" || !Object.prototype.hasOwnProperty.call(ISSUES_DEPOT, code)) {
    return null;
  }
  return { texte: ISSUES_DEPOT[code as CodeIssueDepot], ok: code === "recu" };
}
