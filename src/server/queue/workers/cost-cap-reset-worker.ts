/**
 * Cost cap reset worker — Sprint Final 2026-05-22 (P0-2 audit final pré-prod).
 *
 * Sans ce worker + cron `cost-cap-reset-cron` (1er du mois 00:00 UTC), le
 * compteur Redis du mois courant s'accumule indéfiniment et le kill-switch
 * global content-gen se déclenche à perpétuité dès le 1er mois prod = OUTAGE
 * TOTAL content-gen silencieux.
 *
 * La fonction `resetMonthlyCostCounters()` existe dans `cost-tracker.ts` mais
 * n'avait aucun déclencheur. Ce worker boucle juste la déclaration de cron
 * (queues.ts) → invocation atomique.
 *
 * Idempotent : si déjà reset pour le mois courant, no-op (cf. logique interne
 * `resetMonthlyCostCounters`).
 */

import { Worker, type Job } from "bullmq";
import { resetMonthlyCostCounters } from "@/server/content-gen/lib/cost-tracker";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

export const QUEUE_NAME = "cost-cap-reset";

interface CostCapResetJobPayload {
  trigger: string;
  tick: string;
}

async function processJob(job: Job<CostCapResetJobPayload>): Promise<void> {
  console.log(
    `[cost-cap-reset] tick=${job.data.tick} trigger=${job.data.trigger} → calling resetMonthlyCostCounters()`,
  );
  // Fix 2026-08-15 (audit e2e, F1) — `resetMonthlyCostCounters()` ne remettait
  // que les compteurs à 0 : les providers désactivés par le cost-cap (et le
  // kill switch auto) restaient coupés à perpétuité, contredisant l'en-tête de
  // ce worker. La fonction réarme désormais aussi ce que le cost-cap a coupé
  // et retourne un récapitulatif — journalisé ici pour l'audit trail Coolify.
  const summary = await resetMonthlyCostCounters();
  console.log(
    `[cost-cap-reset] reset ${summary.countersReset} provider counter(s) for new month — ` +
      `reenabled=[${summary.reenabledProviders.join(", ")}] killSwitchLifted=${summary.killSwitchLifted}`,
  );
}

let workerInstance: Worker<CostCapResetJobPayload> | null = null;

export function startCostCapResetWorker(): Worker<CostCapResetJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — cost-cap-reset-worker cannot start");
  workerInstance = new Worker<CostCapResetJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[cost-cap-reset-worker] job ${job?.id} failed:`, err);
    captureWorkerError("cost-cap-reset", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopCostCapResetWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
