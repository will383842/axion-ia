// Worker BullMQ — Qualiopi Formation crons (T6).
//
// Queue unique `formation-crons` qui dispatche par `type`. Pattern miroir de
// `booking-crons-worker.ts` — 1 seule queue, handlers idempotents, fail-soft
// par entité.
//
// Jobs actifs (T6) :
//   - formation-crons.date-debut   : planifiee → en_cours quand dateDebut <= now
//   - formation-crons.cloture-auto : en_cours  → realisee quand dateFin + 24h <= now
//
// Extension T15 (RAPPELS — hors T6) :
//   Rappels J-7/J-5 (convocation stagiaires), J+1 (satisfaction), J+30 (suivi)
//   sont des EMAILS. Ils seront câblés ici via de nouveaux types de job dans T15,
//   en utilisant le même dispatcher. Ajouter dans HANDLERS :
//     "formation-crons.rappel-j7"  : scan sessions planifiees J-7, enqueueEmail convocation
//     "formation-crons.rappel-satisfaction" : scan sessions realisees J+1, enqueueEmail satisfaction
//     "formation-crons.rappel-suivi"        : scan sessions realisees J+30, enqueueEmail suivi
//   Décision T6 : aucun stub ni mock — les handlers email seront réels à T15.

import { Worker } from "bullmq";
import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import { assertSessionTransition } from "@/server/qualiopi/formations/state-machine";
import {
  decideSessionTransitions,
  type SessionCronSnapshot,
} from "@/server/qualiopi/formations/crons";
import { writeSessionTransition } from "@/server/qualiopi/formations/transition-helper";
import type { TrainingSessionStatut } from "@/server/qualiopi/formations/types";
import type { Prisma } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types job
// ─────────────────────────────────────────────────────────────────────────────

export type FormationCronJobType = "formation-crons.date-debut" | "formation-crons.cloture-auto";

export interface FormationCronJobData {
  type: FormationCronJobType;
  tick: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne : écriture d'une FormationTransition + update statut (cron)
// Réutilise writeSessionTransition du helper partagé (formations/transition-helper.ts).
// ─────────────────────────────────────────────────────────────────────────────

async function applyTransitionInTx(
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    from: TrainingSessionStatut;
    to: TrainingSessionStatut;
    trigger: string;
  },
): Promise<void> {
  await writeSessionTransition(tx, {
    sessionId: input.sessionId,
    from: input.from,
    to: input.to,
    trigger: input.trigger,
    triggeredBy: "cron",
  });
  await tx.trainingSession.update({
    where: { id: input.sessionId },
    data: { statut: input.to },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily 08:00 UTC — planifiee → en_cours quand dateDebut <= now.
 *
 * Scan toutes les sessions `planifiee` dont dateDebut est passée. Pour chacune,
 * applique la transition en_cours dans une transaction idempotente.
 * Fail-soft par session : une erreur sur une session ne bloque pas les autres.
 */
async function handleDateDebut(): Promise<void> {
  const now = new Date();

  // Scan uniquement les sessions planifiees dont dateDebut est dépassée.
  const candidates = await prisma.trainingSession.findMany({
    where: {
      statut: "planifiee",
      dateDebut: { lte: now },
    },
    select: { id: true, statut: true, dateDebut: true, dateFin: true },
  });

  // Utilise la fonction pure pour la décision (testable en isolation).
  const snapshots: SessionCronSnapshot[] = candidates.map((s) => ({
    id: s.id,
    statut: s.statut as TrainingSessionStatut,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
  }));
  const decisions = decideSessionTransitions(snapshots, now).filter((d) => d.to === "en_cours");

  let applied = 0;
  for (const decision of decisions) {
    try {
      // assertSessionTransition lève si la machine d'états l'interdit.
      assertSessionTransition(decision.from, decision.to);

      await prisma.$transaction(async (tx) => {
        await applyTransitionInTx(tx, {
          sessionId: decision.sessionId,
          from: decision.from,
          to: decision.to,
          trigger: "cron.date_debut",
        });
      });
      applied++;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        // @@unique [sessionId, toStatus, trigger] → déjà appliqué, idempotent ok.
        applied++;
        continue;
      }
      // Fail-soft : log et continue les autres sessions.
      console.error(
        `[formation-crons] date-debut: erreur session ${decision.sessionId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] date-debut: ${applied}/${decisions.length} transition(s) planifiee→en_cours (${candidates.length} candidats scannés)`,
  );
}

/**
 * Daily 08:00 UTC — en_cours → realisee quand dateFin + 24h <= now (auto-clôture).
 *
 * Scan toutes les sessions `en_cours` dont dateFin + 24h est passée. Pour chacune,
 * applique la transition realisee dans une transaction idempotente.
 * Fail-soft par session.
 */
async function handleClotureAuto(): Promise<void> {
  const now = new Date();
  // Calcule le seuil : dateFin <= now - 24h
  const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const candidates = await prisma.trainingSession.findMany({
    where: {
      statut: "en_cours",
      dateFin: { lte: threshold },
    },
    select: { id: true, statut: true, dateDebut: true, dateFin: true },
  });

  const snapshots: SessionCronSnapshot[] = candidates.map((s) => ({
    id: s.id,
    statut: s.statut as TrainingSessionStatut,
    dateDebut: s.dateDebut,
    dateFin: s.dateFin,
  }));
  const decisions = decideSessionTransitions(snapshots, now).filter((d) => d.to === "realisee");

  let applied = 0;
  for (const decision of decisions) {
    try {
      assertSessionTransition(decision.from, decision.to);

      await prisma.$transaction(async (tx) => {
        await applyTransitionInTx(tx, {
          sessionId: decision.sessionId,
          from: decision.from,
          to: decision.to,
          trigger: "cron.cloture_auto_j24h",
        });
      });
      applied++;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2002") {
        applied++;
        continue;
      }
      console.error(
        `[formation-crons] cloture-auto: erreur session ${decision.sessionId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[formation-crons] cloture-auto: ${applied}/${decisions.length} transition(s) en_cours→realisee (${candidates.length} candidats scannés)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker dispatcher (exporté pour test d'intégration)
// ─────────────────────────────────────────────────────────────────────────────

const HANDLERS: Record<FormationCronJobType, () => Promise<void>> = {
  "formation-crons.date-debut": handleDateDebut,
  "formation-crons.cloture-auto": handleClotureAuto,
};

/** Logique de dispatch pure (exportée pour les tests). */
export async function formationCronsHandler(data: FormationCronJobData): Promise<void> {
  const handler = HANDLERS[data.type];
  if (!handler) {
    console.warn(`[formation-crons-worker] unknown job type: ${data.type}`);
    return;
  }
  await handler();
}

export function startFormationCronsWorker(): Worker<FormationCronJobData> {
  const worker = new Worker<FormationCronJobData>(
    "formation-crons",
    async (job) => {
      await formationCronsHandler(job.data);
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      lockDuration: 120_000,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  );

  worker.on("ready", () => console.log("[formation-crons-worker] ready"));
  worker.on("failed", (job, err) => {
    console.error(`[formation-crons-worker] failed type=${job?.data?.type ?? "?"}: ${err.message}`);
    captureWorkerError("formation-crons", "formation-crons", job, err);
  });

  return worker;
}
