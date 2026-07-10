// Planning unifié — libellés d'affichage (purs, testables).

import { dayKeyInParis, timeInParis } from "@/lib/calendar-grid";
import { expandEventDayKeys } from "./expand";

/**
 * Libellé horaire d'un événement, en Europe/Paris.
 *
 * - multi-jours       → « 09:00 · 2 jours »
 * - créneau même jour → « 09:00 – 17:00 »
 * - sans fin connue   → « 09:00 »
 * - sans fin ET à minuit (séance coaching legacy sans heure) → « journée entière »
 */
export function planningTimeLabel(e: { debut: Date; fin: Date | null }): string {
  const debutLabel = timeInParis(e.debut);

  if (e.fin === null) {
    return debutLabel === "00:00" ? "journée entière" : debutLabel;
  }

  const startKey = dayKeyInParis(e.debut);
  const endKey = dayKeyInParis(e.fin);

  if (startKey !== endKey) {
    const nbJours = expandEventDayKeys(e.debut, e.fin).length;
    return `${debutLabel} · ${nbJours} jours`;
  }

  return `${debutLabel} – ${timeInParis(e.fin)}`;
}
