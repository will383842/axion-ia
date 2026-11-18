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
 * VALEUR DE DÉPART / COMPATIBILITÉ uniquement (F1a-bis, 2026-11-12). Le catalogue vit en base
 * (table `cibles_reseau`, saisie par l'écran, sans limite) : ne pas ajouter de guide ici.
 * Reste exporté pour les importeurs actuels (contrat.ts, page-confirmation.ts,
 * app/guide-reseau/route.ts) qui valident encore le code de la demande avec cette liste.
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

// ── Page « Recevoir le guide » (lot S2, 2026-11-08 ; corrigé le 2026-11-11) ─────────────────
// Décisions de Williams : prénom OBLIGATOIRE ; UNE case OBLIGATOIRE qui ne parle QUE du guide ;
// UNE case SÉPARÉE, FACULTATIVE et décochée pour les informations d'Axion-IA (RGPD art. 7(4) : le
// consentement aux informations n'est jamais couplé à la remise du guide). Aucune ligne
// `newsletter_subscribers` n'est créée. L'accord « optin » ne part au CRM que pour la 2e case ET
// si l'interrupteur `newsletter_optin` est allumé (`newsletterOptinPageGuideActif`).

/** Référence du registre de preuve (`consent_events.form_ref`) pour la case du guide. */
export const FORM_REF_PAGE_GUIDE = "guide-reseau-page";
/** Référence du registre de preuve pour la case FACULTATIVE des informations. */
export const FORM_REF_PAGE_GUIDE_INFOS = "guide-reseau-page-infos";

/** Version du texte de la case du guide. Changer le texte = changer cette version ET l'empreinte. */
export const VERSION_CONSENTEMENT_PAGE_GUIDE = "page-guide-2026-11-11";
/** Version du texte de la case des informations (même règle). */
export const VERSION_CONSENTEMENT_PAGE_GUIDE_INFOS = "page-guide-infos-2026-11-11";

/** Texte de la case OBLIGATOIRE : elle ne parle que du guide. À valider par Williams. */
export const TEXTE_CASE_PAGE_GUIDE = "J'accepte de recevoir le guide à cette adresse";
/** Texte de la case FACULTATIVE (décochée). À valider par Williams. */
export const TEXTE_CASE_PAGE_GUIDE_INFOS =
  "Je souhaite aussi recevoir les informations d'Axion-IA par e-mail, désinscription à tout moment";

/**
 * SHA-256 (hex) des textes ci-dessus. Écrites en dur pour que ce module reste PUR ; un test
 * recalcule les empreintes et refuse tout écart (texte modifié sans la version ni l'empreinte).
 */
export const EMPREINTE_CASE_PAGE_GUIDE =
  "9a72fe5c24d93e687484018bad4a3ffa2b9ac94ed639c1d437730dfe25ca1b69";
export const EMPREINTE_CASE_PAGE_GUIDE_INFOS =
  "7dc800ccb7ed2a9884ab199b02902a2102e37cd0cb20b32352e37097090098bb";

/** Bornes du prénom (caractères, après suppression des espaces de bord). */
export const PRENOM_MIN = 1;
export const PRENOM_MAX = 50;

/** Chemin de la page (hors `[locale]`, comme `/questionnaire`). */
export const CHEMIN_PAGE_GUIDE = "/guide-reseau";
