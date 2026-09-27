/**
 * RÉSEAU D'APPORTEURS — passages planifiés (2026-09-27).
 *
 *   · `relance-invitation` (08:00 UTC) — rappels J+3 / J+7 de l'invitation à
 *     l'échange de 15 minutes, pour les personnes qui n'ont pas réservé
 *     (`features/commercial-application/relances-invitation-apporteur.ts`).
 *
 * Doctrine de log : on ne journalise que ce qui s'est passé. Un passage qui ne
 * trouve rien à faire se tait ; un passage suspendu (lien de réservation absent)
 * le dit, parce que c'est une panne de configuration, pas une journée calme.
 */

import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { ApporteurCronJobData, ApporteurCronJobType } from "@/server/queue/types";

export const APPORTEUR_CRONS_QUEUE_NAME = "apporteur-crons";

export type { ApporteurCronJobData, ApporteurCronJobType };

async function processJob(_job: Job<ApporteurCronJobData>): Promise<void> {
  // Import PARESSEUX : le passage tire `queues.ts`, importé par toute Server
  // Action — chargé à l'exécution, ce coût n'existe que dans le worker.
  const { passerRelancesInvitation } =
    await import("@/features/commercial-application/relances-invitation-apporteur");
  const r = await passerRelancesInvitation();
  if (r.suspendu) return; // déjà dit par le passage lui-même
  const parties = r.envoyees.j3 + r.envoyees.j7;
  if (parties > 0) {
    console.warn(
      `[apporteur-crons] rappels d'invitation : ${r.envoyees.j3} premier(s) rappel(s), ` +
        `${r.envoyees.j7} dernier(s) rappel(s), sur ${r.personnes} personne(s) invitée(s) ` +
        `dans la fenêtre — écartées : ${JSON.stringify(r.ecartees)}`,
    );
  }
}

let workerInstance: Worker<ApporteurCronJobData> | null = null;

export function startApporteurCronsWorker(): Worker<ApporteurCronJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — apporteur-crons-worker cannot start");

  workerInstance = new Worker<ApporteurCronJobData>(APPORTEUR_CRONS_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // 1 : deux passages simultanés liraient le même état avant que l'un ait
    // écrit — le jobId déterministe éviterait le doublon d'envoi, pas le
    // double travail.
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[apporteur-crons-worker] job ${job?.id} failed:`, err);
    captureWorkerError("apporteur-crons", APPORTEUR_CRONS_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

export async function stopApporteurCronsWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
