/**
 * Les textes d'e-mail aux formateurs indépendants que Will valide (M1, lot A).
 *
 * Un texte = un gabarit (`textes_valides.<gabarit>`) ou une VARIANTE validée à part
 * (`textes_valides.<gabarit>#<variante>`). La liste est DÉRIVÉE de ce que lisent les
 * envois : chaque gabarit de `TEXTES_FORMATEUR`, chaque variante de
 * `VARIANTES_VALIDEES_A_PART`, et la variante chiffrée de F23 (son texte de base part
 * sans validation : il n'est pas proposé).
 *
 * Pur : l'écran et les actions le lisent ; le registre reste `textes-valides.ts`.
 */

import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import { VARIANTES_VALIDEES_A_PART } from "@/server/qualiopi/formateurs-independants/envois-variantes";

import { cleTexteValide } from "./textes-valides";

export interface TexteAValider {
  readonly gabarit: string;
  readonly variante?: string;
}

/** F23 chiffrée (`proposition-chiffree.ts`, `VARIANTE_F23_HONORAIRES`). */
const F23_HONORAIRES: TexteAValider = {
  gabarit: "formateur-mission-proposee",
  variante: "honoraires",
};

export const TEXTES_FORMATEURS_A_VALIDER: readonly TexteAValider[] = [
  ...Object.keys(TEXTES_FORMATEUR).map((gabarit) => ({ gabarit })),
  ...Object.entries(VARIANTES_VALIDEES_A_PART).flatMap(([gabarit, parEtape]) =>
    [...new Set(Object.values(parEtape ?? {}))].map((variante) => ({ gabarit, variante })),
  ),
  F23_HONORAIRES,
];

export function cleDuTexte(t: TexteAValider): string {
  return cleTexteValide(t.gabarit, t.variante);
}

const CLES = new Set(TEXTES_FORMATEURS_A_VALIDER.map(cleDuTexte));

/** Ce texte se valide-t-il sur l'écran des gabarits ? */
export function estTexteFormateurAValider(gabarit: string, variante?: string): boolean {
  try {
    return CLES.has(cleTexteValide(gabarit, variante));
  } catch {
    return false;
  }
}
