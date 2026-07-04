/**
 * Worker — Delta Sirene quotidien (prospection T3).
 *
 * Consomme la file `prospection-delta`. Applique créations/cessations/changements
 * en ré-ingérant le fichier delta (même schéma que le Stock → upsert idempotent :
 * une cessation devient `etatAdministratif=cesse`, jamais purgée = historique).
 * Stub-aware + no-op si aucun fichier delta configuré.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { ingestSireneStock } from "@/server/prospection/sources/sirene-stock-ingestor";
import { LocalFileStockSource, isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionDeltaJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-delta";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";

let workerInstance: Worker<ProspectionDeltaJobData> | null = null;

async function processJob(job: Job<ProspectionDeltaJobData>) {
  if (isBuildStub()) {
    console.warn("[prospection-delta] stub.invalid → skip");
    return { skipped: "stub" as const };
  }
  const deltaUniteLegale = job.data.deltaPath ?? process.env.PROSPECTION_DELTA_UNITE_LEGALE_PATH;
  const deltaEtablissement = process.env.PROSPECTION_DELTA_ETABLISSEMENT_PATH;

  if (!deltaUniteLegale && !deltaEtablissement) {
    console.warn("[prospection-delta] aucun fichier delta configuré → no-op");
    return { skipped: "no-file" as const };
  }

  const source = new LocalFileStockSource({
    uniteLegale: deltaUniteLegale,
    etablissement: deltaEtablissement,
  });
  const summary = await ingestSireneStock(source, prisma);
  console.log("[prospection-delta] terminé", summary);
  return summary;
}

export function startProspectionDeltaWorker(): Worker<ProspectionDeltaJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionDeltaJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 1_800_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-delta", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
