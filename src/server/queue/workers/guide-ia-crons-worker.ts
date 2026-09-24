/**
 * GUIDE IA — passages planifiés (lot L2, 2026-09-24).
 *
 *   · `rattrapage` (horaire, :07)  — reprend les guides restés sans envoi
 *     (`server/guide-ia/rattrapage.ts`) ;
 *   · `sentinelle` (06:40 UTC)     — compare demandes et envois, alerte si la
 *     chaîne est coupée, et envoie le récapitulatif du jour.
 *
 * Doctrine de log : on ne journalise que ce qui s'est passé. Un « rien à faire »
 * horaire noierait les journaux ; dès qu'il y a du travail, le compte rendu est
 * explicite.
 */

import { Worker, type Job } from "bullmq";

import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import type { GuideIaCronJobData, GuideIaCronJobType } from "@/server/queue/types";

export const GUIDE_IA_CRONS_QUEUE_NAME = "guide-ia-crons";

export type { GuideIaCronJobData, GuideIaCronJobType };

async function processJob(job: Job<GuideIaCronJobData>): Promise<void> {
  const type: GuideIaCronJobType = job.data.type ?? (job.name as GuideIaCronJobType);

  if (type === "sentinelle") {
    // Import PARESSEUX : `queues.ts` est importé par toute Server Action, et la
    // sentinelle tire le hub de notifications. Chargé à l'exécution, ce coût
    // n'existe que dans le worker.
    const { passerSentinelle } = await import("@/server/guide-ia/sentinelle");
    await passerSentinelle();
    return;
  }

  const { rattraperGuides } = await import("@/server/guide-ia/rattrapage");
  const r = await rattraperGuides();
  if (r.suspendu) {
    console.warn("[guide-ia-crons] rattrapage SUSPENDU : coupe-circuit des rebonds déclenché");
    return;
  }
  if (r.candidates > 0 || r.confirmationsRelancees > 0) {
    console.warn(
      `[guide-ia-crons] rattrapage : ${r.relancees}/${r.candidates} guide(s) relancé(s), ` +
        `${r.reparees} trace(s) réparée(s), ${r.ecartees} écartée(s), ` +
        `${r.confirmationsRelancees} proposition(s) de réinscription à la lettre`,
    );
  }
}

let workerInstance: Worker<GuideIaCronJobData> | null = null;

export function startGuideIaCronsWorker(): Worker<GuideIaCronJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — guide-ia-crons-worker cannot start");

  workerInstance = new Worker<GuideIaCronJobData>(GUIDE_IA_CRONS_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    // 1 : deux rattrapages simultanés reprendraient les mêmes demandes.
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`[guide-ia-crons-worker] job ${job?.id} failed:`, err);
    captureWorkerError("guide-ia-crons", GUIDE_IA_CRONS_QUEUE_NAME, job, err);
  });

  return workerInstance;
}

export async function stopGuideIaCronsWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
