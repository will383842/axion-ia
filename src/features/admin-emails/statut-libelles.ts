/**
 * Libellés et tons des statuts d'envoi — module PUR (ni Prisma, ni session).
 *
 * Sortis de `./query` le 2026-09-18 pour être lus aussi par les fiches qui
 * disent l'accusé de réception automatique (messages, candidatures) : un
 * composant d'affichage n'a pas à importer un module qui ouvre la base, et
 * les mêmes statuts ne doivent pas avoir deux jeux de mots dans la console.
 */

import type { EmailLogStatus } from "../../../prisma/generated/client";

/**
 * Libellé français de CHAQUE statut — lot 3 (2026-09-02). Typé sur l'énum :
 * un statut ajouté sans libellé ne compile plus. Avant, la vue portait sa
 * propre table à trois entrées, et « bounced » s'affichait en anglais brut
 * dans une console française — sur le seul statut qui exige un geste humain.
 */
export const LIBELLES_STATUT_EMAIL: Readonly<Record<EmailLogStatus, string>> = {
  pending: "En attente",
  sent: "Envoyé",
  failed: "Échec",
  bounced: "Rebond",
  // 🔴 2026-09-09 — AJOUTÉ AVANT QUE LA VALEUR N'EXISTE EN BASE, et c'est
  // délibéré. Cette carte est la seule source des libellés ; une ligne portant
  // un statut absent d'ici s'afficherait avec une cellule VIDE — pas une
  // erreur, pas un rouge, juste un trou que personne ne remarque. Le libellé
  // précède donc l'écriture du statut, jamais l'inverse.
  cancelled: "Annulé",
};

/** Libellé complet d'une ligne : le type de rebond compte, il commande le geste. */
export function libelleStatutLigne(l: {
  readonly status: EmailLogStatus;
  readonly bounceType: string | null;
}): string {
  if (l.status === "bounced") {
    return l.bounceType === "hard"
      ? "Rebond définitif"
      : l.bounceType === "soft"
        ? "Rebond temporaire"
        : "Rebond";
  }
  return LIBELLES_STATUT_EMAIL[l.status];
}

/**
 * Ton du badge, par statut. Le vert ne vaut que pour un envoi CONFIRMÉ ; un
 * rebond, même temporaire, se voit.
 */
export const TON_STATUT_EMAIL: Readonly<
  Record<EmailLogStatus, "success" | "warning" | "destructive" | "neutral">
> = {
  sent: "success",
  pending: "warning",
  failed: "destructive",
  bounced: "destructive",
  cancelled: "neutral",
};
