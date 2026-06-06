/**
 * Utilitaires de temps — Émargement / présence Qualiopi.
 *
 * Toutes les dates civiles utilisent le fuseau Europe/Paris.
 * Aucun import Prisma / accès DB.
 */

import type { DemiJourneeLabel } from "./types";

/** Fuseau réglementaire pour les dates civiles. */
const FUSEAU_PARIS = "Europe/Paris";

/**
 * Formate un nombre de minutes en chaîne "HhMM".
 *
 * @example formatMinutesToHHhMM(423) → "7h03"
 * @example formatMinutesToHHhMM(45)  → "0h45"
 */
export function formatMinutesToHHhMM(min: number): string {
  const totalMinutes = Math.max(0, Math.round(min));
  const heures = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${heures}h${String(minutes).padStart(2, "0")}`;
}

/**
 * Retourne la date ISO "YYYY-MM-DD" d'un instant UTC en fuseau Europe/Paris.
 *
 * @example parisDateISO(new Date("2026-06-10T22:00:00Z")) → "2026-06-11"
 */
export function parisDateISO(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: FUSEAU_PARIS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Produit un libellé lisible pour un créneau, ex. "2026-06-10 matin".
 *
 * Les valeurs de `DemiJourneeLabel` ("matin", "apres_midi", "journee") sont
 * remplacées par les libellés français correspondants.
 */
export function parisDateLabel(iso: string, dj: DemiJourneeLabel): string {
  const labelDj: Record<DemiJourneeLabel, string> = {
    matin: "matin",
    apres_midi: "après-midi",
    journee: "journée",
  };
  return `${iso} ${labelDj[dj]}`;
}
