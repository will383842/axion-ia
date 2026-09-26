/**
 * ARCHIVE FIGÉE des textes de consentement et d'information déjà servis par le
 * formulaire du guide et par la réinscription à la lettre (audit final du plan
 * newsletter, 2026-09-26).
 *
 * 🔴 Le défaut. `consent_events.consent_version` consigne une VERSION, et
 * `guide-ia-formulaire.ts` ne garde que le texte EN VIGUEUR. Le 26/09, la case
 * est passée de v3 à v4, la mention pro de v1 à v2, la réinscription de v2 à
 * v3 : les preuves déjà écrites sous v3/v1/v2 désignaient un texte qui
 * n'existait plus que dans l'historique git. Une preuve de consentement doit
 * pouvoir dire QUEL texte la personne a lu, sans fouiller un dépôt.
 *
 * Ici : une ligne par version déjà servie, texte FR et EN recopiés LITTÉRALEMENT
 * (jamais dérivés des constantes en vigueur : l'archive changerait avec elles).
 * Retrouvés par `git log -p -- src/content/guide-ia-formulaire.ts` :
 *   · 421809823 (#1157, 24/09) : case v3, mention pro v1, mention perso v1,
 *     réinscription v1 ;
 *   · aeb80bbb8 (#1158, 25/09) : réinscription v2 ;
 *   · 23fb391cf (#1170, 26/09) : case v4, mention pro v2, réinscription v3.
 *
 * Les mentions sont archivées telles que la constante les porte ; le lien
 * « Politique de confidentialité » est ajouté par le formulaire à côté.
 *
 * Verrou : `__tests__/guide-ia-formulaire-archive.spec.ts` — rougit si une
 * version en vigueur manque ici, si son texte diffère de la constante servie,
 * ou si un texte archivé change.
 *
 * 🔑 Ajouter une ligne à chaque nouvelle version ; n'en modifier ni n'en
 * retirer JAMAIS aucune.
 *
 * ⚠️ Module PUR et séparé de `guide-ia-formulaire.ts` à dessein : celui-ci est
 * importé par un composant client, et l'archive n'a rien à faire dans le
 * JavaScript envoyé au navigateur.
 */

export interface TexteArchive {
  /** Références de collecte (`consent_events.form_ref`) sous lesquelles il a été servi. */
  readonly formRefs: readonly string[];
  /** Premier jour de service (jour du commit qui l'a introduit). */
  readonly depuis: string;
  readonly fr: string;
  readonly en: string;
}

const SUITE_V1_FR =
  "Quand vous ouvrez le guide depuis l'e-mail, votre adresse est aussi enregistrée dans notre outil de suivi de la relation client ; vous pouvez vous y opposer à tout moment. Conservation : 3 ans après votre dernier échange avec nous. Pour exercer vos droits : contact@axion-ia.com.";
const SUITE_V1_EN =
  "When you open the guide from the email, your address is also recorded in our customer relationship tool; you can object at any time. Retention: 3 years after your last exchange with us. To exercise your rights: contact@axion-ia.com.";

/** Les mentions sont servies aux deux points de collecte (page du guide et encart). */
const REFS_MENTION = ["newsletter-guide-ia", "newsletter-encart-article"] as const;

export const ARCHIVE_TEXTES_CONSENTEMENT: Readonly<Record<string, TexteArchive>> = {
  // ── Case « lettre » (adresses personnelles) ────────────────────────────────
  "lettre-guide-v3-2026-09-24": {
    formRefs: ["newsletter-guide-ia"],
    depuis: "2026-09-24",
    fr: "Je souhaite aussi recevoir la lettre d'Axion-IA (quelques lettres par an).",
    en: "I would also like to receive Axion-IA's letter (a few emails a year).",
  },
  "lettre-article-v3-2026-09-24": {
    formRefs: ["newsletter-encart-article"],
    depuis: "2026-09-24",
    fr: "Je souhaite aussi recevoir la lettre d'Axion-IA (quelques lettres par an).",
    en: "I would also like to receive Axion-IA's letter (a few emails a year).",
  },
  "lettre-guide-v4-2026-09-26": {
    formRefs: ["newsletter-guide-ia"],
    depuis: "2026-09-26",
    fr: "Je veux aussi recevoir les nouveautés IA utiles (1 à 2 e-mails par mois).",
    en: "I also want to receive useful AI updates (1 to 2 emails a month).",
  },
  "lettre-article-v4-2026-09-26": {
    formRefs: ["newsletter-encart-article"],
    depuis: "2026-09-26",
    fr: "Je veux aussi recevoir les nouveautés IA utiles (1 à 2 e-mails par mois).",
    en: "I also want to receive useful AI updates (1 to 2 emails a month).",
  },

  // ── Mention d'information sous le bouton ───────────────────────────────────
  "guide-mention-pro-v1-2026-09-24": {
    formRefs: REFS_MENTION,
    depuis: "2026-09-24",
    fr: `En recevant le guide, vous recevrez aussi quelques lettres par an, à chaque nouveauté utile. Désinscription en un clic, à tout moment. ${SUITE_V1_FR}`,
    en: `Along with the guide, you will also receive a few emails a year, only when there is something new and useful. One-click unsubscribe, at any time. ${SUITE_V1_EN}`,
  },
  "guide-mention-pro-v2-2026-09-26": {
    formRefs: REFS_MENTION,
    depuis: "2026-09-26",
    fr: `En recevant le guide, vous recevrez aussi 1 à 2 e-mails par mois, à chaque nouveauté utile. Désinscription en un clic, à tout moment. ${SUITE_V1_FR}`,
    en: `Along with the guide, you will also receive 1 to 2 emails a month, only when there is something new and useful. One-click unsubscribe, at any time. ${SUITE_V1_EN}`,
  },
  "guide-mention-perso-v1-2026-09-24": {
    formRefs: REFS_MENTION,
    depuis: "2026-09-24",
    fr: `Le guide vous est envoyé par e-mail. La lettre d'Axion-IA ne vous est envoyée que si vous cochez la case ci-dessus ; désinscription en un clic, à tout moment. ${SUITE_V1_FR}`,
    en: `The guide is sent to you by email. Axion-IA's letter is only sent to you if you tick the box above; one-click unsubscribe, at any time. ${SUITE_V1_EN}`,
  },

  // ── Réinscription d'une personne désabonnée ────────────────────────────────
  // v1 : jamais enregistrée en production (remplacée avant la mise en ligne),
  // archivée quand même — une preuve qui la citerait doit pouvoir se relire.
  "lettre-reinscription-email-v1-2026-09-24": {
    formRefs: ["newsletter-reinscription-email"],
    depuis: "2026-09-24",
    fr: "Vous vous étiez désabonné(e) de la lettre d'Axion-IA. Pour la recevoir à nouveau (quelques lettres par an, à chaque nouveauté utile), confirmez d'un clic ; sans ce clic, rien ne change.",
    en: "You had unsubscribed from Axion-IA's letter. To receive it again (a few emails a year, only when there is something new and useful), confirm with one click; without it, nothing changes.",
  },
  "lettre-reinscription-email-v2-2026-09-25": {
    formRefs: ["newsletter-reinscription-email"],
    depuis: "2026-09-25",
    fr: "Vous aviez quitté la lettre d'Axion-IA. Pour la recevoir à nouveau (quelques lettres par an, à chaque nouveauté utile), confirmez d'un clic ; sans ce clic, rien ne change.",
    en: "You had left Axion-IA's letter. To receive it again (a few emails a year, only when there is something new and useful), confirm with one click; without it, nothing changes.",
  },
  "lettre-reinscription-email-v3-2026-09-26": {
    formRefs: ["newsletter-reinscription-email"],
    depuis: "2026-09-26",
    fr: "Vous aviez quitté la lettre d'Axion-IA. Pour la recevoir à nouveau (1 à 2 e-mails par mois, à chaque nouveauté utile), confirmez d'un clic ; sans ce clic, rien ne change.",
    en: "You had left Axion-IA's letter. To receive it again (1 to 2 emails a month, only when there is something new and useful), confirm with one click; without it, nothing changes.",
  },
};

/** Le texte archivé d'une version, ou `null` si elle n'a jamais été servie. */
export function texteDeLaVersion(version: string): TexteArchive | null {
  return Object.prototype.hasOwnProperty.call(ARCHIVE_TEXTES_CONSENTEMENT, version)
    ? (ARCHIVE_TEXTES_CONSENTEMENT[version] ?? null)
    : null;
}
