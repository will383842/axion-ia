/**
 * Clés de configuration dont l'ÉCRITURE exige le droit `habiliter_formateur`.
 *
 * 🔴 Les seuils de l'indicateur 21 (`evaluation_competences_*`, `suivi_qualite_*`) décident
 * de gardes — activation d'un formateur indépendant, suspension de ses missions. Les
 * écrire avec la seule garde d'écriture (`requireAdminWrite`) laissait `editor` et
 * `secretaire` les régler : `suivi_qualite_satisfaction_suspension_sous = 1` suffisait à
 * ne plus jamais suspendre. La lecture reste ouverte à tout rôle admin.
 *
 * Module PUR (ni Prisma, ni Next).
 */

import { BORNES_EVALUATION } from "@/server/qualiopi/formateurs-independants/evaluation-competences/reglages";
import { BORNES_SUIVI_QUALITE } from "@/server/qualiopi/formateurs-independants/suivi-qualite/reglages";

export const PREFIXES_CLES_RESERVEES = ["evaluation_competences_", "suivi_qualite_"] as const;

/** Cette clé est-elle réservée aux détenteurs de `habiliter_formateur` ? */
export function cleReserveeHabilitation(cle: string): boolean {
  return PREFIXES_CLES_RESERVEES.some((p) => cle.startsWith(p));
}

const snake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Bornes [min, max, pas] de chaque clé réservée — les mêmes que celles de la LECTURE. */
export const BORNES_CLES_RESERVEES: Readonly<Record<string, readonly [number, number, number]>> = {
  ...Object.fromEntries(
    Object.entries(BORNES_EVALUATION).map(([k, b]) => [`evaluation_competences_${snake(k)}`, b]),
  ),
  ...Object.fromEntries(
    Object.entries(BORNES_SUIVI_QUALITE).map(([k, b]) => [`suivi_qualite_${snake(k)}`, b]),
  ),
};

/** Message de refus si la valeur sort des bornes d'une clé réservée, sinon `null`. */
export function refusBorneCleReservee(cle: string, valeur: number): string | null {
  const b = BORNES_CLES_RESERVEES[cle];
  if (b === undefined) return null;
  const [min, max, pas] = b;
  const auPas = Math.abs(valeur / pas - Math.round(valeur / pas)) < 1e-9;
  if (Number.isFinite(valeur) && valeur >= min && valeur <= max && auPas) return null;
  return `Valeur hors bornes pour « ${cle} » : de ${min} à ${max}, par pas de ${pas}.`;
}
