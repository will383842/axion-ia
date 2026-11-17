/**
 * Ce que l'écran dit d'une réponse à un candidat, selon son statut d'envoi.
 *
 * `sent` signifie « accepté par le relais d'envoi » (SMTP 250), PAS « remis dans
 * la boîte du candidat » : l'écran dit « Envoyé » et ne promet jamais la remise.
 * L'énumération `JobApplicationReplyStatus` ne connaît que `pending`, `sent`,
 * `failed` et `bounced` : il n'existe aucun statut de remise confirmée, donc
 * aucune phase « remise ».
 *
 * Module pur, sans `"use server"` : il est importé par le composeur (client).
 */

export const LIBELLE_ENVOYE = "Envoyé (accepté par le relais d'envoi).";
export const LIBELLE_TRAITEMENT_LONG =
  "Envoi en cours de traitement, vérifiez la frise avant de renvoyer.";

/**
 * Phrase affichée quand le serveur du destinataire a refusé l'adresse (`bounced`).
 * Sans colonne de type de rebond, on ne sait pas distinguer un refus définitif
 * d'un refus temporaire : aucun « Réessayer », il faut écrire de nouveau.
 */
export const LIBELLE_REBOND =
  "Adresse refusée par le serveur du destinataire : vérifier l'adresse avant d'écrire de nouveau.";

export type PhaseApresSondage = "envoye" | "echec" | "rebond" | null;

/** Phase à afficher d'après le statut lu en base ; `null` = rien de tranché. */
export function phaseApresSondage(statut: string): PhaseApresSondage {
  if (statut === "sent") return "envoye";
  if (statut === "failed") return "echec";
  if (statut === "bounced") return "rebond";
  return null;
}
