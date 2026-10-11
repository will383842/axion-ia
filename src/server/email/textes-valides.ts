/**
 * FAC-1 — Registre générique « texte validé par Will » (squelette).
 */
export const PREFIXE_TEXTES_VALIDES = "textes_valides.";
export type RegistreTextesValides = ReadonlySet<string>;
const AFAIRE = (): never => {
  throw new Error("FAC-1 : à implémenter");
};
export function cleTexteValide(_gabarit: string, _variante?: string): string {
  return AFAIRE();
}
export function textesValidesDepuisLignes(
  _lignes: ReadonlyArray<{ key: string; value: unknown }>,
): RegistreTextesValides {
  return AFAIRE();
}
export function estTexteValide(
  _registre: RegistreTextesValides,
  _gabarit: string,
  _variante?: string,
): boolean {
  return AFAIRE();
}
