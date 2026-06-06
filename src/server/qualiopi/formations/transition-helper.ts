/**
 * Qualiopi — Helper partagé d'écriture FormationTransition.
 *
 * Extrait de sessions.ts pour être réutilisable depuis :
 *   - src/server/actions/qualiopi/sessions.ts (Server Actions)
 *   - src/server/actions/qualiopi/sessions-recurrentes.ts
 *   - src/server/queue/workers/qualiopi-formation-crons-worker.ts
 *
 * Ce module est intentionnellement sans "use server" — il est pur serveur
 * (Node uniquement) mais n'est pas une Server Action. Importable par workers
 * BullMQ, Server Actions, et tests Vitest.
 *
 * T6 — extrait lors de l'ajout du worker de crons et des sessions récurrentes/report.
 */

import type {
  Prisma,
  TrainingSessionStatut,
  TransitionTriggeredBy,
} from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WriteSessionTransitionInput {
  sessionId: string;
  from: TrainingSessionStatut | null;
  to: TrainingSessionStatut;
  trigger: string;
  triggeredBy: TransitionTriggeredBy;
  triggeredById?: string | null;
  reason?: string | null;
  snapshotBefore?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
  snapshotAfter?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Écrit une ligne FormationTransition dans la transaction fournie.
 *
 * Idempotence via @@unique [sessionId, toStatus, trigger] : si la ligne existe
 * déjà (P2002), l'appelant doit catcher et ignorer.
 *
 * NE FAIT PAS le `trainingSession.update` — la mise à jour du statut est à la
 * charge de l'appelant (séparation de responsabilités, transaction atomique).
 */
export async function writeSessionTransition(
  tx: Prisma.TransactionClient,
  input: WriteSessionTransitionInput,
): Promise<void> {
  await tx.formationTransition.create({
    data: {
      sessionId: input.sessionId,
      // fromStatus est nullable (null = création initiale). Spread conditionnel
      // pour respecter exactOptionalPropertyTypes : on ne passe pas undefined.
      ...(input.from !== null ? { fromStatus: input.from } : {}),
      toStatus: input.to,
      trigger: input.trigger.slice(0, 80),
      triggeredBy: input.triggeredBy,
      ...(input.triggeredById !== undefined ? { triggeredById: input.triggeredById } : {}),
      ...(input.reason !== undefined && input.reason !== null ? { reason: input.reason } : {}),
      ...(input.snapshotBefore !== undefined ? { snapshotBefore: input.snapshotBefore } : {}),
      ...(input.snapshotAfter !== undefined ? { snapshotAfter: input.snapshotAfter } : {}),
    },
  });
}
