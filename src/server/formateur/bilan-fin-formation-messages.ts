/**
 * Espace formateur — ce que dit l'écran du bilan de fin de formation après un geste.
 * Court, sans jargon. Partagé par le bloc serveur (`BilanFinFormation`) et le formulaire
 * de l'avis (`AvisBilanForm`), qui l'affiche SANS quitter la page (V2-N-3).
 */

export const MESSAGES_BILAN: Readonly<Record<string, { texte: string; ok: boolean }>> = {
  ok: { texte: "C'est enregistré.", ok: true },
  deja_evalue: { texte: "Ce stagiaire est déjà évalué.", ok: true },
  deja_donne: { texte: "Votre avis est déjà enregistré.", ok: true },
  notes_invalides: { texte: "Choisissez une réponse pour chaque objectif.", ok: false },
  avis_invalide: { texte: "Écrivez quelques lignes (10 caractères au moins).", ok: false },
  incomplet: { texte: "Il reste quelque chose à faire avant de terminer.", ok: false },
  dossier_clos: {
    texte: "Le dossier de cette session est clos : prévenez l'organisme pour cette évaluation.",
    ok: false,
  },
  stagiaire_inconnu: { texte: "Ce stagiaire n'est pas à évaluer ici.", ok: false },
  termine: { texte: "Votre bilan est déjà terminé.", ok: true },
};

/** Refus de l'avis sans message dédié : le texte reste à l'écran, l'organisme est nommé. */
export const AVIS_NON_ENREGISTRE =
  "Votre avis n'a pas pu être enregistré. Votre texte est gardé ci-dessous : réessayez, ou écrivez-nous.";

/** Connexion tombée pendant la saisie : on ne redirige pas, le texte resterait derrière. */
export const AVIS_CONNEXION_EXPIREE =
  "Votre connexion a expiré. Votre texte est gardé ci-dessous : copiez-le, reconnectez-vous, puis collez-le.";

/** Ce que l'action de l'avis rend au formulaire après un refus : le message et la saisie. */
export interface EtatAvisBilan {
  readonly ok: false;
  readonly message: string;
  /** Rang du refus : remonte les champs à chaque refus, même deux fois le même. */
  readonly essai: number;
  readonly commentaire: string;
  /** `""` = aucune note choisie ; sinon « 1 » à « 5 ». */
  readonly note: string;
}
