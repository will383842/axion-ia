/**
 * Content Generator — Anti-burst scheduler (Sprint 7 V2).
 *
 * Fonction pure qui décide pour chaque type combien de jobs enqueue *maintenant*
 * pour respecter une cible quotidienne étalée uniformément sur 24h.
 *
 * Algorithme :
 *   - On a un targetByType (ex : { blog_article: 24 }) → 24 jobs/jour.
 *   - 24h = 86 400 000 ms → 1 job toutes les 3 600 000 ms (1h).
 *   - À l'instant t (ms depuis startOfDay), nombre de jobs attendus :
 *       expected = ceil((t / 86_400_000) * target)
 *   - Si createdToday < expected ∧ createdToday < target → enqueue (expected - createdToday).
 *
 * Garantie : sur 24h pleines, on enqueue exactement `target` jobs, distribués
 * de façon (quasi) uniforme. Si un tick rate (15 min) passe à côté → rattrapage
 * automatique au tick suivant.
 *
 * Si anti-burst désactivé : retourne `target - createdToday` (rattrape tout d'un coup).
 *
 * Fonction pure : pas d'I/O, 100% testable.
 */

import type { ContentType } from "../../../../prisma/generated/client";

export interface AntiBurstInput {
  /** Cibles/jour par type. Type absent ou target=0 → ignoré. */
  readonly targetByType: Partial<Record<ContentType, number>>;
  /** Nb de jobs déjà créés today (status != cancelled) par type. */
  readonly createdTodayByType: Partial<Record<ContentType, number>>;
  /** Temps écoulé depuis startOfDay UTC (ms). 0 ≤ t ≤ 86_400_000. */
  readonly msSinceStartOfDay: number;
  /** Si true : étalement uniforme sur 24h. Si false : rattrape tout d'un coup. */
  readonly antiBurstEnabled: boolean;
}

export interface AntiBurstDecision {
  /** Type concerné. */
  readonly contentType: ContentType;
  /** Nb de jobs à enqueue maintenant pour rattraper la cible. */
  readonly enqueueCount: number;
}

const MS_PER_DAY = 86_400_000;

export function computeAntiBurstSchedule(input: AntiBurstInput): ReadonlyArray<AntiBurstDecision> {
  const decisions: AntiBurstDecision[] = [];
  const tClamped = Math.max(0, Math.min(MS_PER_DAY, input.msSinceStartOfDay));

  for (const [typeRaw, targetRaw] of Object.entries(input.targetByType)) {
    const target = typeof targetRaw === "number" ? targetRaw : 0;
    if (target <= 0) continue;

    const contentType = typeRaw as ContentType;
    const created = input.createdTodayByType[contentType] ?? 0;
    if (created >= target) continue;

    let enqueueCount: number;
    if (!input.antiBurstEnabled) {
      enqueueCount = target - created;
    } else {
      const expected = Math.ceil((tClamped / MS_PER_DAY) * target);
      const clampedExpected = Math.min(expected, target);
      enqueueCount = Math.max(0, clampedExpected - created);
    }

    if (enqueueCount > 0) {
      decisions.push({ contentType, enqueueCount });
    }
  }

  return decisions;
}

/** Helper pour les workers : extraire le ms depuis startOfDay UTC. */
export function msSinceStartOfDay(now: Date = new Date()): number {
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return now.getTime() - startOfDay;
}
