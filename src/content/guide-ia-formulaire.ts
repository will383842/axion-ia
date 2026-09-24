/**
 * LES TEXTES DU FORMULAIRE DU GUIDE — source unique, et ARCHIVE de preuve.
 *
 * POURQUOI CE FICHIER (lot L2, 2026-09-24)
 *
 * Décision n° 1 de Will : le guide part tout de suite par e-mail ; la lettre
 * devient une case FACULTATIVE, décochée, à double opt-in. Deux finalités, deux
 * bases légales (6.1.b pour le guide, 6.1.a pour la lettre) — et donc un texte
 * accepté qu'il faut pouvoir PROUVER.
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

/** Version du texte de la case « lettre », par point de collecte. */
export const VERSION_LETTRE: Record<VarianteFormulaireGuide, string> = {
  guide: "lettre-guide-v2-2026-09-24",
  article: "lettre-article-v2-2026-09-24",
};

/** Version de la mention d'information affichée sous le formulaire (demande du guide). */
export const VERSION_MENTION_GUIDE = "guide-mention-v1-2026-09-24";

/**
 * Décision n° 4 de Will (24/09) — la cadence réelle de la lettre. Remplace la
 * promesse « mensuelle », jamais tenue. Liste fermée de ses emplois :
 * `decision-4-plus-de-mensuel.spec.ts`.
 */
export const CADENCE_LETTRE: Record<LocaleFormulaire, string> = {
  fr: "Quelques lettres par an, à chaque nouveauté utile.",
  en: "A few emails a year, only when there is something new and useful.",
};

/** Texte EXACT de la case « lettre », par point de collecte et par langue. */
export const TEXTE_CASE_LETTRE: Record<
  VarianteFormulaireGuide,
  Record<LocaleFormulaire, string>
> = {
  guide: {
    fr: `Je souhaite aussi recevoir la lettre IA d'Axion-IA. ${CADENCE_LETTRE.fr} Désinscription en un clic dans chaque e-mail.`,
    en: `I also want to receive Axion-IA's AI letter. ${CADENCE_LETTRE.en} One-click unsubscribe in every email.`,
  },
  article: {
    fr: `Je souhaite aussi recevoir la lettre IA d'Axion-IA. ${CADENCE_LETTRE.fr} Désinscription en un clic.`,
    en: `I also want to receive Axion-IA's AI letter. ${CADENCE_LETTRE.en} One-click unsubscribe.`,
  },
};

/**
 * Mention d'information (art. 13 RGPD, première couche) sous le formulaire.
 * Le lien vers la politique de confidentialité est ajouté par le formulaire.
 */
export const TEXTE_MENTION_GUIDE: Record<LocaleFormulaire, string> = {
  fr: "Axion-IA utilise votre adresse pour vous envoyer le guide et, si vous cochez la case, sa lettre. Quand vous ouvrez le guide depuis l'e-mail, votre adresse est aussi enregistrée dans notre outil de suivi de la relation client ; vous pouvez vous y opposer à tout moment. Conservation : 3 ans après votre dernier échange avec nous. Pour exercer vos droits : contact@axion-ia.com.",
  en: "Axion-IA uses your address to send you the guide and, if you tick the box, its letter. When you open the guide from the email, your address is also recorded in our customer relationship tool; you can object at any time. Retention: 3 years after your last exchange with us. To exercise your rights: contact@axion-ia.com.",
};

/** Libellé du lien vers la politique, et son chemin localisé. */
export const LIEN_POLITIQUE: Record<LocaleFormulaire, { libelle: string; href: string }> = {
  fr: { libelle: "Politique de confidentialité", href: "/fr/politique-confidentialite" },
  en: { libelle: "Privacy policy", href: "/en/privacy-policy" },
};

/** Libellés du formulaire, par point de collecte et par langue. */
export interface LibellesFormulaireGuide {
  email: string;
  lettre: string;
  mention: string;
  politique: { libelle: string; href: string };
  submit: string;
  sending: string;
  success: string;
  /** Ajouté au succès quand la case « lettre » était cochée. */
  successLettre: string;
  failure: string;
}

const COMMUNS: Record<
  LocaleFormulaire,
  Omit<LibellesFormulaireGuide, "email" | "lettre" | "mention" | "politique">
> = {
  fr: {
    submit: "Recevoir le guide",
    sending: "Envoi…",
    success:
      "C'est parti : le guide arrive dans votre boîte e-mail d'ici quelques minutes. Pensez à regarder dans les indésirables.",
    successLettre:
      "Pour la lettre, confirmez votre inscription avec le bouton prévu dans ce même e-mail.",
    failure: "Erreur. Réessayez ou écrivez à contact@axion-ia.com.",
  },
  en: {
    submit: "Get the guide",
    sending: "Sending…",
    success:
      "On its way: the guide will reach your inbox within a few minutes. Check your spam folder too.",
    successLettre: "For the letter, confirm your subscription with the button in that same email.",
    failure: "Error. Try again or email contact@axion-ia.com.",
  },
};

export function libellesFormulaireGuide(
  variante: VarianteFormulaireGuide,
  locale: LocaleFormulaire,
): LibellesFormulaireGuide {
  return {
    email: locale === "fr" ? "E-mail professionnel" : "Work email",
    lettre: TEXTE_CASE_LETTRE[variante][locale],
    mention: TEXTE_MENTION_GUIDE[locale],
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
  "blog-fin-article",
  "actualites-fin-article",
  "guides-fin-article",
] as const;
export type SourceGuide = (typeof SOURCES_GUIDE)[number];

/** Point de collecte d'une provenance : la page du guide, ou un encart d'article. */
export function varianteDeSource(source: SourceGuide): VarianteFormulaireGuide {
  return source === "guide-ia" ? "guide" : "article";
}
