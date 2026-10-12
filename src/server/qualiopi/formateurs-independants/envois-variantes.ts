/**
 * Variantes ajoutées APRÈS la validation possible du gabarit : elles se
 * valident à part (`textes_valides.<gabarit>#<variante>`). Sans cette clé,
 * rien ne part — jamais un texte neuf sous une validation ancienne.
 * Clé : gabarit → (n° d'étape du payload → nom de la variante).
 *
 * Pur (aucun import d'exécution) : lu par l'adaptateur d'envoi (`envois.ts`) ET par
 * l'écran de validation des textes (`server/email/textes-formateurs-a-valider.ts`),
 * qui ne peut proposer que ce que l'envoi exigera.
 */

import type { GabaritFormateurIndependant } from "@/lib/email/templates/formateur-independant-textes";

export const VARIANTES_VALIDEES_A_PART: Readonly<
  Partial<Record<GabaritFormateurIndependant, Readonly<Record<number, string>>>>
> = {
  // L11e (fin de mission) — lettre non signée : aucune indemnité annoncée.
  "formateur-mission-retiree": { 2: "lettre-non-signee" },
  "formateur-formation-annulee": { 2: "lettre-non-signee" },
};
