/**
 * Qualiopi — Logique pure de décision des auto-transitions cron (module PUR).
 *
 * PRINCIPES :
 *   - Aucun import Prisma/BullMQ/next. Testable sans DB.
 *   - La décision est séparée de l'exécution (clean architecture).
 *   - `decideSessionTransitions` prend une liste de sessions snapshot
 *     et une date de référence → retourne la liste des transitions à appliquer.
 *
 * Règles métier :
 *   - planifiee → en_cours  quand dateDebut <= now
 *   - en_cours  → realisee  quand dateFin + 24h <= now  (auto-clôture J+1)
 *
 * SOURCE : T6 spec Sessions & inscriptions — auto-transitions + récurrentes + report.
 */

import type { TrainingSessionStatut } from "@/server/qualiopi/formations/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Snapshot minimal d'une session nécessaire à la décision cron. */
export interface SessionCronSnapshot {
  id: string;
  statut: TrainingSessionStatut;
  dateDebut: Date;
  dateFin: Date;
}

/** Transition à appliquer sur une session. */
export interface SessionTransitionDecision {
  sessionId: string;
  from: TrainingSessionStatut;
  to: TrainingSessionStatut;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constante
// ─────────────────────────────────────────────────────────────────────────────

/** Délai d'auto-clôture en ms après dateFin (24 heures). */
export const AUTO_CLOTURE_DELAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Fonction pure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détermine les transitions à appliquer sur un lot de sessions.
 *
 * @param sessions Snapshots des sessions à analyser.
 * @param now      Date de référence (UTC). Injectée pour testabilité.
 * @returns Liste ordonnée des décisions à appliquer (sans doublons par session).
 *
 * @example
 * const decisions = decideSessionTransitions(sessions, new Date());
 * // [{ sessionId: "...", from: "planifiee", to: "en_cours" }, ...]
 */
export function decideSessionTransitions(
  sessions: SessionCronSnapshot[],
  now: Date,
): SessionTransitionDecision[] {
  const decisions: SessionTransitionDecision[] = [];
  const nowMs = now.getTime();

  for (const s of sessions) {
    if (s.statut === "planifiee" && s.dateDebut.getTime() <= nowMs) {
      decisions.push({ sessionId: s.id, from: "planifiee", to: "en_cours" });
    } else if (s.statut === "en_cours" && s.dateFin.getTime() + AUTO_CLOTURE_DELAY_MS <= nowMs) {
      decisions.push({ sessionId: s.id, from: "en_cours", to: "realisee" });
    }
  }

  return decisions;
}
