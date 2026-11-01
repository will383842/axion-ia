/**
 * PARCOURS « MOT EN COMMENTAIRE → MESSAGE PRIVÉ → E-MAIL → GUIDE » — constantes et
 * TEXTES (lot PV-1, 2026-11-01).
 *
 * ⛔ BROUILLONS. Tous les textes de ce fichier (bloc de confirmation du double accord,
 * mentions) sont des PROPOSITIONS à valider par l'opérateur avant toute mise en ligne.
 * Ils ne sont jamais définitifs : les changer = changer la version correspondante.
 *
 * ⚠️ Module PUR (aucun import) : lu par l'app, le worker et un gabarit d'e-mail.
 */

/** Réseaux d'où une demande peut venir (contrat de synchro PV-0, document 04). */
export const RESEAUX_GUIDE = [
  "instagram",
  "facebook",
  "linkedin_page",
  "tiktok",
  "page_guide",
] as const;
export type ReseauGuide = (typeof RESEAUX_GUIDE)[number];

/**
 * Guides qu'un réseau peut demander (code = `guide_requests.aimant`). Liste FERMÉE :
 * un code inconnu est refusé (422), il ne crée pas d'aimant. Un second guide s'ajoute
 * ICI, avec son PDF et son gabarit.
 */
export const GUIDES_RESEAU_CONNUS: readonly string[] = ["guide-ia"];

/** Références du registre de preuve (`consent_events.form_ref`). */
export const FORM_REF_INFORMATION_RESEAU = "guide-reseau-message-prive";
export const FORM_REF_ACCORD_RESEAU = "newsletter-reseau-message-prive";

/** Source écrite sur la demande et sur l'abonné : `mot-{mot}:{reseau}`. */
export function sourceReseau(mot: string, reseau: ReseauGuide): string {
  return `mot-${mot.toLowerCase()}:${reseau}`;
}

/** BROUILLON — bloc de confirmation du double accord, dans l'e-mail du guide. */
export const TEXTE_CONFIRMATION_RESEAU = {
  fr: {
    titre: "Vos conseils par e-mail : un dernier geste",
    corps:
      "Dans notre conversation, vous avez répondu « Oui » pour recevoir aussi nos conseils par e-mail. Pour que ce soit bien votre choix, confirmez-le d'un clic. Sans ce clic, vous ne recevrez rien d'autre que ce guide.",
    cta: "Oui, je confirme",
    note: "Vous n'avez pas répondu « Oui » ? Ignorez simplement ce message : aucun conseil ne vous sera envoyé.",
  },
  en: {
    titre: "Your tips by e-mail: one last step",
    corps:
      "In our conversation, you answered “Yes” to also receive our tips by e-mail. To make sure it is your choice, please confirm with one click. Without this click, you will receive nothing other than this guide.",
    cta: "Yes, I confirm",
    note: "You did not answer “Yes”? Just ignore this message: no tips will be sent to you.",
  },
} as const;
