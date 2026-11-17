/**
 * Ce que l'écran dit d'une réponse à un candidat, selon son statut d'envoi.
 *
 * `sent` signifie « accepté par le relais d'envoi » (SMTP 250), PAS « remis dans
 * la boîte du candidat » : afficher « Remise confirmée » dès `sent` affirmait une
 * remise que rien n'a constatée. Seul un statut de remise réelle (`delivered`,
 * posé par le retour du relais) autorise ce libellé.
 *
 * Module pur, sans `"use server"` : il est importé par le composeur (client).
 */

export const LIBELLE_ENVOYE_EN_ATTENTE = "Envoyé, en attente de confirmation.";
export const LIBELLE_REMISE_CONFIRMEE = "Remise confirmée.";

export type PhaseApresSondage = "envoye" | "remise" | "echec" | null;

/** Phase à afficher d'après le statut lu en base ; `null` = rien de tranché. */
export function phaseApresSondage(statut: string): PhaseApresSondage {
  if (statut === "delivered") return "remise";
  if (statut === "sent") return "envoye";
  if (statut === "failed" || statut === "bounced") return "echec";
  return null;
}
