/**
 * Qualiopi — Machine à états des sessions de formation (module PUR).
 *
 * PRINCIPES :
 *   1. **Whitelist explicite** — SESSION_TRANSITIONS = Record<from, to[]>.
 *      Toute transition non listée → refus immédiat.
 *   2. **Pur et testable** — aucun import Prisma/next ici. Importable par
 *      les Server Actions, workers BullMQ, et tests Vitest sans side-effects.
 *
 * SOURCE : spec SPEC_PART2 §2.3 cycle de vie session.
 */

import type { TrainingSessionStatut } from "@/server/qualiopi/formations/types";

// ─────────────────────────────────────────────────────────────────────────────
// Transitions autorisées (whitelist)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transitions de statut autorisées pour une TrainingSession.
 *
 * - planifiee → en_cours, annulee, reportee
 * - en_cours  → realisee, annulee
 * - realisee  → [] (terminal)
 * - annulee   → [] (terminal)
 * - reportee  → [] (terminal au sens de ce statut ; la session de remplacement
 *               est une nouvelle entité avec son propre cycle de vie)
 */
export const SESSION_TRANSITIONS: Record<TrainingSessionStatut, TrainingSessionStatut[]> = {
  planifiee: ["en_cours", "annulee", "reportee"],
  en_cours: ["realisee", "annulee"],
  realisee: [],
  annulee: [],
  reportee: [],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Guards purs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie si une transition de `from` vers `to` est autorisée.
 * Retourne `true` si la transition figure dans la whitelist.
 */
export function canTransitionSession(
  from: TrainingSessionStatut,
  to: TrainingSessionStatut,
): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

/**
 * Lance une erreur si la transition est interdite.
 *
 * @throws Error avec message descriptif si la transition n'est pas dans
 *         la whitelist (SESSION_TRANSITIONS).
 */
export function assertSessionTransition(
  from: TrainingSessionStatut,
  to: TrainingSessionStatut,
): void {
  if (!canTransitionSession(from, to)) {
    throw new Error(
      `Transition de session interdite : ${from} → ${to}. ` +
        `Transitions autorisées depuis ${from} : [${SESSION_TRANSITIONS[from].join(", ") || "aucune — statut terminal"}]`,
    );
  }
}
