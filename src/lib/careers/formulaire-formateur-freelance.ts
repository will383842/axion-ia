/** Lot L0c-1 — squelette (test rouge). */

export function modeFormateurFreelance(_e: {
  readonly formulaireAllume: boolean;
  readonly natureLue: boolean;
  readonly offre: Record<string, unknown> | null | undefined;
}): boolean {
  throw new Error("L0c-1 : non implémenté");
}

export type ChampsFormateurFreelance =
  | { ok: true; codePostal: string; formations: string; reponses: Record<string, string> }
  | { ok: false; error: string };

export function lireChampsFormateurFreelance(
  _lire: (cle: string) => string | null,
): ChampsFormateurFreelance {
  throw new Error("L0c-1 : non implémenté");
}
