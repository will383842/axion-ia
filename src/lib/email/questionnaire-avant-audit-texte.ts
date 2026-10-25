// Le texte MODIFIABLE de l'invitation au questionnaire avant audit (2026-10-25, ordre de Will :
// lire l'e-mail exact, le modifier avant le premier envoi, éditer le texte de base).
//
// Module PUR (aucune base, aucun React) : le gabarit, la console et le worker l'importent.
//
// ⛔ Ce qui n'est JAMAIS modifiable : le bouton et son lien personnel, la note « ce lien vous est
//    personnel », la formule de fin et le pied légal. Ils vivent dans le gabarit, pas ici.
// ⛔ Le texte est du TEXTE : il est rendu par React (échappé), jamais injecté comme HTML. On retire
//    en plus les caractères de contrôle et les sauts de ligne de l'objet (injection d'en-tête).

/** Jeton du corps : remplacé par « , prévu le <date>, <lieu>, » ou retiré si aucune date n'est connue. */
export const JETON_AUDIT = "{audit}";

export const OBJET_PAR_DEFAUT = "Préparons votre audit : votre questionnaire";

/** Bornes (caractères). L'objet reste lisible dans une boîte de réception. */
export const OBJET_PERSO_MAX = 78;
export const MESSAGE_MAX = 1200;
export const CORPS_MAX = 4000;
export const PARAGRAPHES_MAX = 12;

/**
 * Le texte d'origine du corps, après « Bonjour <prénom>, » et avant le bouton. Paragraphes séparés
 * par une ligne vide. Mot pour mot celui du gabarit d'avant (plan « e-mails, relances, Telegram » §7 E1).
 */
export const CORPS_PAR_DEFAUT = [
  `Merci pour notre échange. Pour préparer notre audit${JETON_AUDIT} nous avons préparé un questionnaire en ligne, pensé pour votre entreprise.`,
  "Il nous aide à comprendre votre quotidien : vos tâches, vos outils, ce qui vous prend du temps. Plus vos réponses sont complètes, plus l'audit sera précis, et plus les pistes que nous vous présenterons seront utiles : du temps gagné, une meilleure rentabilité, de quoi développer votre chiffre d'affaires.",
  "Vous pouvez faire une pause et revenir plus tard avec ce même bouton : ce que vous avez déjà saisi vous attend.",
  "Si vous travaillez avec une équipe, le questionnaire vous proposera un lien à transmettre à vos collaborateurs : chacun répond de son côté.",
].join("\n\n");

const CONTROLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g;

/** Une ligne (objet) : une seule ligne, sans contrôle, bornée. Toute valeur non texte donne "". */
export function assainirLigne(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/[\r\n\t]+/g, " ")
    .replace(CONTROLES, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, max);
}

/** Un texte multi-lignes : fins de ligne normalisées, contrôles retirés, 2 sauts de ligne au plus. */
export function assainirTexte(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/\r\n?/g, "\n")
    .replace(CONTROLES, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Les paragraphes d'un texte (séparés par une ligne vide), vides ignorés, en nombre borné. */
export function enParagraphes(texte: string): string[] {
  return texte
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .slice(0, PARAGRAPHES_MAX);
}

/**
 * Le texte à garder comme surcharge : `null` s'il est vide ou identique à la base (la base garde
 * alors sa vie propre : si Will la modifie plus tard, ce client la suit).
 */
export function surchargeOuNull(
  saisi: unknown,
  base: string,
  max: number = CORPS_MAX,
): string | null {
  const s = assainirTexte(saisi, max);
  if (s === "") return null;
  return s === assainirTexte(base, max) ? null : s;
}

/** Le jeton {audit} remplacé par ce que l'appelant a pré-formaté (chaîne vide = retiré). */
export function remplacerJetonAudit(paragraphe: string, prevu: string): string {
  return paragraphe.split(JETON_AUDIT).join(prevu);
}

export interface GabaritBase {
  objet: string | null;
  corps: string | null;
}

export interface TexteSaisi {
  objet?: unknown;
  message?: unknown;
  corps?: unknown;
}

/** Les champs du payload du gabarit : absents = le gabarit garde son texte d'origine. */
export interface TextePayload {
  objetPerso?: string;
  messagePerso?: string;
  corpsPerso?: string;
}

/**
 * Ce qui part dans le payload : la saisie du client l'emporte, puis la base de Will, puis le texte
 * d'origine du gabarit. Une saisie identique à la base n'est pas une surcharge. PUR.
 */
export function fusionnerTexte(base: GabaritBase, saisi: TexteSaisi): TextePayload {
  const objet = assainirLigne(saisi.objet, OBJET_PERSO_MAX) || base.objet || "";
  const corps = surchargeOuNull(saisi.corps, base.corps ?? CORPS_PAR_DEFAUT) ?? base.corps ?? "";
  const message = assainirTexte(saisi.message, MESSAGE_MAX);
  return {
    ...(objet !== "" ? { objetPerso: objet } : {}),
    ...(message !== "" ? { messagePerso: message } : {}),
    ...(corps !== "" && corps !== CORPS_PAR_DEFAUT ? { corpsPerso: corps } : {}),
  };
}
