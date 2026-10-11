/**
 * Texte par défaut d'un e-mail « modifiable » (FAC-1).
 *
 * Le texte principal d'un gabarit, en texte brut, tel que l'e-mail le dit par
 * défaut : paragraphes séparés par une ligne vide, sans le « Bonjour », le
 * bouton, la signature ni l'information RGPD. Il pré-remplit la zone
 * « Modifier le texte » de la console. Chaque monde fournit SA fonction
 * (`TexteParDefaut`) ; les briques d'assemblage, elles, sont ici, une fois.
 *
 * Pur : aucun import.
 */

/** `null` (ou `undefined`) : le texte de ce gabarit n'est pas modifiable. */
export type TexteParDefaut = (
  gabarit: string,
  payload: Record<string, unknown>,
) => string | null | undefined;

/** Les blocs non vides, séparés par une ligne vide. */
export function assemblerParagraphes(blocs: ReadonlyArray<string | null>): string {
  return blocs.filter((b): b is string => b !== null && b !== "").join("\n\n");
}

/** Une liste en texte brut : puces « • », ou « 1. », « 2. »… */
export function listeTexte(xs: readonly string[], num = false): string {
  return xs.map((x, i) => `${num ? `${i + 1}.` : "•"} ${x}`).join("\n");
}
