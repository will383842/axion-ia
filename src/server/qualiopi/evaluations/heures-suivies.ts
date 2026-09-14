/**
 * Qualiopi — Heures RÉELLEMENT suivies, à la minute.
 *
 * Module PUR (aucun I/O) : lu par le service d'attestation, les deux gabarits
 * d'attestation et l'évaluateur d'alertes.
 *
 * 🔴 2e relecture A09 (audit initial 2026-09-14). Les heures suivies étaient
 * arrondies à l'HEURE (`Math.round(taux × durée / 100)`), puis l'assiduité de la
 * pièce était recalculée depuis cet arrondi : 45 % de 3 h s'imprimait « 1 h sur
 * 3 h (33 %) », et 2 % de 14 h donnait « 0 h » — une pièce qui certifiait un
 * suivi de zéro heure. Le règlement publié promet « les heures effectivement
 * suivies » : elles se comptent en minutes et s'impriment en heures ET minutes.
 */

/** Minutes réellement suivies, arrondies à la minute. */
export function minutesSuivies(tauxPct: number, dureeHeures: number): number {
  return Math.round((tauxPct * dureeHeures * 60) / 100);
}

/** « 6 h 30 », « 7 h », « 0 h » — jamais « 6,5 h ». */
export function heuresMinutesFr(heures: number): string {
  const total = Math.round(heures * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Assiduité calculée sur les MINUTES, pas sur des heures arrondies. */
export function assiduiteSurMinutes(heuresSuivies: number, heuresTotales: number): string {
  const totales = Math.round(heuresTotales * 60);
  if (totales === 0) return "—";
  return `${Math.round((Math.round(heuresSuivies * 60) / totales) * 100)} %`;
}
