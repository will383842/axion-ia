/**
 * 🔴 L'UNIQUE réponse « introuvable » de l'espace formateur.
 *
 * Le service ET les actions formateur (lettre de mission, contrat de travail,
 * relevé de connexion) la renvoient à l'identique — même valeur, même forme,
 * même message — pour un identifiant inconnu, la pièce d'un autre formateur, une
 * pièce d'un type que le formateur ne signe pas, ou une pièce sans session qui
 * ne lui est pas rattachée. Un message propre à chaque action (« Lettre de
 * mission introuvable. », « Contrat de travail introuvable. ») distinguerait,
 * d'une action à l'autre, une pièce existante d'une pièce inventée.
 *
 * Les appelants la RECOPIENT (`{ ...REFUS_PIECE_INTROUVABLE }`) : l'objet gelé
 * n'est jamais rendu tel quel.
 *
 * Module SANS dépendance : les actions l'importent ici, et non depuis le service,
 * pour que les tests qui simulent le service ne la perdent pas avec lui.
 */
export const REFUS_PIECE_INTROUVABLE = Object.freeze({
  ok: false,
  raison: "piece_introuvable",
  message: "Pièce introuvable.",
} as const);
