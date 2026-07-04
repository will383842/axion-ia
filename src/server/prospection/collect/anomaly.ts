/**
 * Prospection — Détection d'anomalies (T9, pur).
 *
 * Comparé au snapshot précédent (03-SPEC §5) : débit −X %, taux 0 anormal (source
 * qui renvoie vide — incident type stub documenté), cellule `en_cours` stale > N h,
 * quota atteint. Les seuils viennent de `SiteSetting` (registry `alerts`). Les
 * alertes sont surfacées sur le Dashboard + tracées dans le Journal. Pur → testable.
 */

export interface AnomalyThresholds {
  debitDropPct: number;
  staleCellHours: number;
  zeroResultAlert: boolean;
}

export interface AnomalySignals {
  /** Entreprises/h sur la fenêtre courante. */
  debitCurrent: number;
  /** Entreprises/h sur la fenêtre précédente. */
  debitPrevious: number;
  /** Sources renvoyant 0 résultat de façon anormale. */
  zeroResultSources: string[];
  /** Nb de cellules `en_cours` depuis plus de `staleCellHours`. */
  staleCells: number;
  /** Campagnes ayant atteint leur quota. */
  quotaReached: number;
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  type: "debit_drop" | "zero_result" | "stale_cell" | "quota_reached";
  severity: AlertSeverity;
  message: string;
}

export function detectAnomalies(s: AnomalySignals, t: AnomalyThresholds): Alert[] {
  const alerts: Alert[] = [];

  if (s.debitPrevious > 0) {
    const dropPct = ((s.debitPrevious - s.debitCurrent) / s.debitPrevious) * 100;
    if (dropPct >= t.debitDropPct) {
      alerts.push({
        type: "debit_drop",
        severity: dropPct >= 90 ? "critical" : "warning",
        message: `Débit en baisse de ${Math.round(dropPct)} % (${s.debitPrevious} → ${s.debitCurrent} entreprises/h).`,
      });
    }
  }

  if (t.zeroResultAlert && s.zeroResultSources.length > 0) {
    alerts.push({
      type: "zero_result",
      severity: "critical",
      message: `Sources renvoyant 0 résultat (incident possible) : ${s.zeroResultSources.join(", ")}.`,
    });
  }

  if (s.staleCells > 0) {
    alerts.push({
      type: "stale_cell",
      severity: "warning",
      message: `${s.staleCells} cellule(s) bloquée(s) en « en_cours » depuis plus de ${t.staleCellHours} h.`,
    });
  }

  if (s.quotaReached > 0) {
    alerts.push({
      type: "quota_reached",
      severity: "info",
      message: `${s.quotaReached} campagne(s) ont atteint leur quota.`,
    });
  }

  return alerts;
}
