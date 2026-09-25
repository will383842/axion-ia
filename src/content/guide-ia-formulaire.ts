/**
 * LES TEXTES DU FORMULAIRE DU GUIDE — source unique, et ARCHIVE de preuve.
 *
 * POURQUOI CE FICHIER (lot L2, 2026-09-24)
 *
 * Décision n° 1 de Will, puis son AMENDEMENT du 24/09 (version finale) : le
 * guide part tout de suite par e-mail, et la lettre suit la nature de l'adresse
 * (`lib/email/nature-adresse.ts`, décidée côté serveur) :
 *   · adresse PROFESSIONNELLE → inscription automatique, intérêt légitime B2B,
 *     sans case ; la preuve est l'INFORMATION donnée (la mention, versionnée) ;
 *   · adresse PERSONNELLE → case facultative, décochée ; cochée, c'est un
 *     consentement, et la preuve est le texte de la case (versionné).
 * Aucun double opt-in dans les deux cas. Le guide ne dépend jamais de la case.
 *
 * Avant ce lot, une seule constante (`newsletter-v1-2026-08-13`) couvrait deux
 * textes différents (page du guide et encart des articles), et aucun n'était
 * archivé : on ne pouvait pas dire QUEL texte une personne avait accepté.
 *
 * Désormais :
 *   · chaque point de collecte a sa référence (`formRef`) et sa version ;
 *   · le texte exact de chaque version vit ICI, et les formulaires l'affichent
 *     depuis ICI — ce qui est archivé est donc, par construction, ce qui a été
 *     montré ;
 *   · 🔑 CHANGER UN TEXTE = CHANGER SA VERSION. `guide-ia-formulaire.spec.ts`
 *     fige l'empreinte de chaque texte : modifier une phrase sans monter la
 *     version fait rougir le test.
 *
 * ⚠️ Module PUR, sans aucune dépendance : importé par un composant client (le
 * formulaire), par des pages, par un gabarit d'e-mail et par le serveur.
 *
 * ⛔ Tout texte de ce fichier est PUBLIC : il ne part en production qu'après
 * validation de Will (règle du chantier).
 */

export type LocaleFormulaire = "fr" | "en";

/** Les deux points de collecte : la page du guide, et l'encart de fin d'article. */
export type VarianteFormulaireGuide = "guide" | "article";

/**
 * Références de collecte de la LETTRE, reprises au registre de preuve
 * (`consent_events.form_ref`). Distinctes de la référence historique
 * `newsletter-double-optin`, qui reste celle des inscriptions antérieures.
 */
export const FORM_REF_LETTRE: Record<VarianteFormulaireGuide, string> = {
  guide: "newsletter-guide-ia",
  article: "newsletter-encart-article",
};

/** Version du texte de la case « lettre » (adresses personnelles), par point de collecte. */
export const VERSION_LETTRE: Record<VarianteFormulaireGuide, string> = {
  guide: "lettre-guide-v3-2026-09-24",
  article: "lettre-article-v3-2026-09-24",
};

/**
 * Versions de la mention d'information affichée sous le bouton. Deux mentions,
 * selon la nature de l'adresse saisie : pour une adresse professionnelle, elle
 * EST le fondement de l'inscription (information + intérêt légitime) ; pour
 * une adresse personnelle, elle renvoie à la case.
 */
export const VERSION_MENTION: Record<"pro" | "perso", string> = {
  pro: "guide-mention-pro-v1-2026-09-24",
  perso: "guide-mention-perso-v1-2026-09-24",
};

/**
 * Décision n° 4 de Will (24/09) — la cadence réelle de la lettre. Remplace la
 * promesse « mensuelle », jamais tenue. Liste fermée de ses emplois :
 * `decision-4-plus-de-mensuel.spec.ts`.
 */
export const CADENCE_LETTRE: Record<LocaleFormulaire, string> = {
  fr: "Quelques lettres par an, à chaque nouveauté utile.",
  en: "A few emails a year, only when there is something new and useful.",
};

/**
 * Texte EXACT de la case « lettre » (adresses personnelles seulement), par
 * point de collecte et par langue. Texte de l'amendement de Will.
 */
export const TEXTE_CASE_LETTRE: Record<
  VarianteFormulaireGuide,
  Record<LocaleFormulaire, string>
> = {
  guide: {
    fr: "Je souhaite aussi recevoir la lettre d'Axion-IA (quelques lettres par an).",
    en: "I would also like to receive Axion-IA's letter (a few emails a year).",
  },
  article: {
    fr: "Je souhaite aussi recevoir la lettre d'Axion-IA (quelques lettres par an).",
    en: "I would also like to receive Axion-IA's letter (a few emails a year).",
  },
};

/** Suite commune aux deux mentions : le CRM (décision D1), la conservation, les droits. */
const MENTION_SUITE: Record<LocaleFormulaire, string> = {
  fr: "Quand vous ouvrez le guide depuis l'e-mail, votre adresse est aussi enregistrée dans notre outil de suivi de la relation client ; vous pouvez vous y opposer à tout moment. Conservation : 3 ans après votre dernier échange avec nous. Pour exercer vos droits : contact@axion-ia.com.",
  en: "When you open the guide from the email, your address is also recorded in our customer relationship tool; you can object at any time. Retention: 3 years after your last exchange with us. To exercise your rights: contact@axion-ia.com.",
};

/**
 * Mention d'information (art. 13 RGPD, première couche) sous le bouton, selon
 * la nature de l'adresse. Le lien vers la politique est ajouté par le formulaire.
 */
export const TEXTE_MENTION: Record<"pro" | "perso", Record<LocaleFormulaire, string>> = {
  pro: {
    fr: `En recevant le guide, vous recevrez aussi quelques lettres par an, à chaque nouveauté utile. Désinscription en un clic, à tout moment. ${MENTION_SUITE.fr}`,
    en: `Along with the guide, you will also receive a few emails a year, only when there is something new and useful. One-click unsubscribe, at any time. ${MENTION_SUITE.en}`,
  },
  perso: {
    fr: `Le guide vous est envoyé par e-mail. La lettre d'Axion-IA ne vous est envoyée que si vous cochez la case ci-dessus ; désinscription en un clic, à tout moment. ${MENTION_SUITE.fr}`,
    en: `The guide is sent to you by email. Axion-IA's letter is only sent to you if you tick the box above; one-click unsubscribe, at any time. ${MENTION_SUITE.en}`,
  },
};

/**
 * RÉINSCRIPTION d'une personne qui s'était désabonnée. Son opposition n'est
 * JAMAIS levée par une simple demande du guide — n'importe qui peut saisir une
 * adresse. L'e-mail « Votre guide » lui PROPOSE seulement de revenir, par un
 * bouton ; seul le clic sur la page qui suit (un POST) la réinscrit, et c'est
 * ce texte-ci qu'elle a accepté.
 */
export const FORM_REF_REINSCRIPTION = "newsletter-reinscription-email";
export const VERSION_REINSCRIPTION = "lettre-reinscription-email-v1-2026-09-24";
export const TEXTE_REINSCRIPTION: Record<LocaleFormulaire, string> = {
  fr: "Vous vous étiez désabonné(e) de la lettre d'Axion-IA. Pour la recevoir à nouveau (quelques lettres par an, à chaque nouveauté utile), confirmez d'un clic ; sans ce clic, rien ne change.",
  en: "You had unsubscribed from Axion-IA's letter. To receive it again (a few emails a year, only when there is something new and useful), confirm with one click; without it, nothing changes.",
};

/** Libellé du lien vers la politique, et son chemin localisé. */
export const LIEN_POLITIQUE: Record<LocaleFormulaire, { libelle: string; href: string }> = {
  fr: { libelle: "Politique de confidentialité", href: "/fr/politique-confidentialite" },
  en: { libelle: "Privacy policy", href: "/en/privacy-policy" },
};

/** Libellés du formulaire, par point de collecte et par langue. */
export interface LibellesFormulaireGuide {
  email: string;
  /** Texte de la case — affichée pour une adresse PERSONNELLE seulement. */
  lettre: string;
  /** Mention sous le bouton, selon la nature de l'adresse saisie. */
  mention: { pro: string; perso: string };
  politique: { libelle: string; href: string };
  submit: string;
  sending: string;
  /** Titre de l'état « envoyé » (lot L1). */
  successTitre: string;
  success: string;
  /** Rappel de l'adresse saisie, suivi de l'adresse (lot L1). */
  envoyeA: string;
  /**
   * Bouton qui rouvre le formulaire pour saisir la bonne adresse (lot L1). Jamais
   * « Corriger » : la première demande N'EST PAS annulée (elle reste envoyée).
   */
  corriger: string;
  failure: string;
}

const COMMUNS: Record<
  LocaleFormulaire,
  Omit<LibellesFormulaireGuide, "email" | "lettre" | "mention" | "politique">
> = {
  fr: {
    submit: "Recevoir le guide",
    sending: "Envoi…",
    successTitre: "Le guide est en route",
    envoyeA: "Envoyé à",
    corriger: "Ce n'est pas la bonne adresse ? Saisir la bonne",
    success:
      "C'est parti : le guide arrive dans votre boîte e-mail d'ici quelques minutes. Pensez à regarder dans les indésirables.",
    failure: "Erreur. Réessayez ou écrivez à contact@axion-ia.com.",
  },
  en: {
    submit: "Get the guide",
    sending: "Sending…",
    successTitre: "The guide is on its way",
    envoyeA: "Sent to",
    corriger: "Wrong address? Enter the right one",
    success:
      "On its way: the guide will reach your inbox within a few minutes. Check your spam folder too.",
    failure: "Error. Try again or email contact@axion-ia.com.",
  },
};

export function libellesFormulaireGuide(
  variante: VarianteFormulaireGuide,
  locale: LocaleFormulaire,
): LibellesFormulaireGuide {
  return {
    // Amendement de Will : TOUTE adresse est acceptée — plus « professionnel ».
    email: locale === "fr" ? "Votre e-mail" : "Your email",
    lettre: TEXTE_CASE_LETTRE[variante][locale],
    mention: { pro: TEXTE_MENTION.pro[locale], perso: TEXTE_MENTION.perso[locale] },
    politique: LIEN_POLITIQUE[locale],
    ...COMMUNS[locale],
  };
}

/**
 * Libellés de provenance acceptés (`source`) — jamais une donnée personnelle.
 * Liste FERMÉE : une valeur hors liste est enregistrée comme absente.
 */
export const SOURCES_GUIDE = [
  "guide-ia",
  // Lot L1 (2026-09-25) — second formulaire, en bas de la page du guide. Le
  // premier garde « guide-ia » : les demandes déjà enregistrées restent lisibles.
  "guide-ia-bas",
  "blog-fin-article",
  "actualites-fin-article",
  "guides-fin-article",
] as const;
export type SourceGuide = (typeof SOURCES_GUIDE)[number];

/** Point de collecte d'une provenance : la page du guide, ou un encart d'article. */
export function varianteDeSource(source: SourceGuide): VarianteFormulaireGuide {
  return source === "guide-ia" || source === "guide-ia-bas" ? "guide" : "article";
}
