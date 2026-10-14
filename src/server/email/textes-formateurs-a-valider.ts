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

import {
  TEXTES_FORMATEUR,
  type GabaritFormateurIndependant,
} from "@/lib/email/templates/formateur-independant-textes";

import { cleTexteValide } from "./textes-valides";

/**
 * Variantes ajoutées APRÈS la validation possible du gabarit : elles se
 * valident à part (`textes_valides.<gabarit>#<variante>`). Sans cette clé,
 * rien ne part — jamais un texte neuf sous une validation ancienne.
 * Clé : gabarit → (n° d'étape du payload → nom de la variante).
 *
 * Lu par l'adaptateur d'envoi des formateurs (`envois.ts`) ET par l'écran de
 * validation : l'écran ne propose que ce que l'envoi exigera.
 */
export const VARIANTES_VALIDEES_A_PART: Readonly<
  Partial<Record<GabaritFormateurIndependant, Readonly<Record<number, string>>>>
> = {
  // L11e (fin de mission) — lettre non signée : aucune indemnité annoncée.
  "formateur-mission-retiree": { 2: "lettre-non-signee", 3: "sans-lettre" },
  "formateur-formation-annulee": { 2: "lettre-non-signee", 3: "sans-lettre" },
  // Lot G1 — F40 à l'approche du seuil de vigilance.
  "formateur-vigilance": { 4: "approche-seuil" },
};

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

/**
 * La liste des textes telle que l'écran l'affiche : les clés, dans l'ordre, une par
 * ligne. « Valider tous les textes » la renvoie et l'action la compare à la liste du
 * moment : un texte remplacé par un autre, à nombre égal, est refusé.
 */
export function listeDesTextesAffichee(): string {
  return TEXTES_FORMATEURS_A_VALIDER.map(cleDuTexte).join("\n");
}

/**
 * La phrase de l'écran d'une VARIANTE : ce que l'envoi exige vraiment. Le texte de
 * base n'est cité que s'il se valide lui aussi (F23 chiffrée : seule la variante).
 */
export function phraseValidationVariante(gabarit: string): string {
  return estTexteFormateurAValider(gabarit)
    ? "Cette variante se valide à part : elle ne part que si le texte de base ET elle sont validés."
    : "Cette variante se valide à part : elle ne part que si elle est validée ici.";
}
