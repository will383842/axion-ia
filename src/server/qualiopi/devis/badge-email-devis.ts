/**
 * Badge d'état d'envoi d'un devis (B2, PR 5, lecture seule).
 *
 * En mode validation humaine, un devis envoyé reste « brouillon » tant que l'e-mail garé n'est
 * pas approuvé : l'écran doit le dire. Un devis marqué envoyé AVANT ce mode (statut « envoyé »)
 * peut porter une ligne encore à valider : l'e-mail n'est alors pas parti, et on le dit aussi.
 */

export const TEXTE_BADGE_A_VALIDER = "E-mail à valider";
export const TEXTE_BADGE_ANCIEN = "Marqué envoyé, e-mail pas encore parti";

export type EtatBadgeEmailDevis = "a_valider" | "ancien" | null;

export function badgeEmailDevis(statut: string, enAttente: boolean): EtatBadgeEmailDevis {
  if (!enAttente) return null;
  if (statut === "brouillon") return "a_valider";
  if (statut === "envoye") return "ancien";
  return null;
}
