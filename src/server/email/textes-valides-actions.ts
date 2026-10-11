"use server";
/**
 * FAC-1 — Acte « valider un texte d'e-mail » (squelette).
 */
export type EtatValidation = { ok: true; message: string } | { ok: false; error: string };
export async function validerTexteEmailAction(_d: {
  gabarit: string;
  variante?: string;
  valide: boolean;
}): Promise<EtatValidation> {
  return { ok: false, error: "FAC-1 : à implémenter" };
}
