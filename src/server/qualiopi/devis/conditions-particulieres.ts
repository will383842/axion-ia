/**
 * Conditions particulières d'un devis CLASSIQUE — logique PURE.
 *
 * Ni zod ni prisma : ce module est importé par le formulaire client (compteur,
 * avertissement) comme par le schéma serveur et les gabarits.
 */

import { TEXTE_GARANTIE_JOURNEE_IA } from "@/server/qualiopi/devis/assistant/textes-rubriques";

/** Longueur maximale du texte, après normalisation côté serveur. */
export const CONDITIONS_PARTICULIERES_MAX = 4000;

/** Nombre maximal de lignes du texte, après normalisation. */
export const CONDITIONS_PARTICULIERES_LIGNES_MAX = 80;

export const MESSAGE_CONDITIONS_PARTICULIERES_LIGNES =
  "Les conditions particulières ne peuvent pas dépasser 80 lignes.";

/**
 * Phrase de primauté : texte contractuel que le fondateur n'a pas encore validé.
 *
 * ⚖️ Elle n'est imprimée ni affichée tant que `PHRASE_PRIMAUTE_VALIDEE` est faux. Une fois
 * validée, elle est posée comme DONNÉE de rendu dans la photo de la pièce (`phrasePrimaute`) :
 * le PDF et la page de signature la lisent dans la photo, jamais ici.
 */
export const PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES =
  "Les présentes conditions particulières, acceptées par la signature du présent devis, dérogent aux Conditions générales de vente ; en cas de contradiction, elles prévalent.";

/**
 * Passer à `true` quand le fondateur a validé le texte de la phrase de primauté. Aucun changement
 * de version de gabarit n'est nécessaire : seules les NOUVELLES photos de pièce la porteront.
 */
export const PHRASE_PRIMAUTE_VALIDEE = false;

/** La phrase à figer dans la photo d'une pièce, ou `null` tant qu'elle n'est pas validée. */
export function phrasePrimauteAImprimer(): string | null {
  return PHRASE_PRIMAUTE_VALIDEE ? PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES : null;
}

/**
 * Mots qui ne doivent pas figurer sur un devis pour le moment. L'avertissement de
 * la saisie n'est pas bloquant : le serveur ne refuse rien.
 */
export const MOTS_SENSIBLES = [
  "certification",
  "certifié",
  "qualiopi",
  "opco",
  "prise en charge",
  "financement",
  "financeur",
] as const;

/**
 * Normalise la saisie : CRLF → LF, U+2028 et U+2029 → saut de ligne, tabulation → espace,
 * caractères de contrôle et invisibles retirés (U+200B-200F, U+202A-202E, U+2060-2069, U+FEFF),
 * trois sauts de ligne ou plus ramenés à deux, bords retirés ; vide → `null`.
 */
export function normaliserConditionsParticulieres(s: string): string | null {
  const texte = s
    .replace(/\r\n?|[\u2028\u2029]/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return texte === "" ? null : texte;
}

/** Nombre de lignes d'un texte DÉJÀ normalisé (un texte sans saut de ligne en compte une). */
export function nombreDeLignes(texte: string): number {
  return texte.split("\n").length;
}

function sansCasseNiAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Mots sensibles présents dans `s` (sans casse ni accents), dans l'ordre de la liste. */
export function motsSensiblesTrouves(s: string): string[] {
  const texte = sansCasseNiAccents(s);
  return MOTS_SENSIBLES.filter((m) => texte.includes(sansCasseNiAccents(m)));
}

/**
 * Garantie de la Journée IA dans le texte des conditions particulières (la colonne
 * `Devis.journeeIa` reste la source de vérité ; le texte n'en est que l'impression, le gabarit du
 * devis imprimant déjà ce bloc). Idempotent : le paragraphe n'est jamais posé deux fois.
 *
 * `true` : ajoute le paragraphe s'il manque, à la fin. `false` : le retire.
 * Le contrôle des 4 000 caractères / 80 lignes reste à l'appelant (schéma serveur, formulaire).
 */
export function avecGarantieJourneeIa(texte: string | null, actif: boolean): string | null {
  const present = (texte ?? "").includes(TEXTE_GARANTIE_JOURNEE_IA);
  // Rien à faire : on rend le texte tel quel (aucune retouche d'espaces à l'insu de l'auteur).
  if (actif === present) return texte;
  const paragraphes = (texte ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "" && p !== TEXTE_GARANTIE_JOURNEE_IA);
  if (actif) paragraphes.push(TEXTE_GARANTIE_JOURNEE_IA);
  return paragraphes.length === 0 ? null : paragraphes.join("\n\n");
}
