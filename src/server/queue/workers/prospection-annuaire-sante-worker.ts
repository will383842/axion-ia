/**
 * Worker — Ingestion Annuaire Santé / RPPS (prospection V2).
 *
 * Consomme la file `prospection-annuaire-sante`. Fichier local (extract « PS
 * LibreAccès ») référencé par `PROSPECTION_RPPS_PATH`. Stub-aware.
 *
 * ⚠️ Données NOMINATIVES de professionnels de santé : l'ingestor lui-même throw
 * si `PROSPECTION_SANTE_INGESTION_ENABLED != "true"` (garde-fou AIPD). Le worker
 * n'exécute donc rien tant que ce flag n'est pas positionné (après validation AIPD).
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import {
  ingestAnnuaireSante,
  LocalFileAnnuaireSanteSource,
} from "@/server/prospection/sources/annuaire-sante-ingestor";
import { getProspectionConfig } from "@/server/prospection/config/site-settings";
import { isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionAnnuaireSanteJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-annuaire-sante";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";
let workerInstance: Worker<ProspectionAnnuaireSanteJobData> | null = null;

async function processJob(job: Job<ProspectionAnnuaireSanteJobData>) {
  if (isBuildStub()) {
    console.warn("[prospection-annuaire-sante] stub.invalid → skip");
    return { skipped: "stub" as const };
  }
  const rppsPath = job.data.rppsPath ?? process.env.PROSPECTION_RPPS_PATH;
  if (!rppsPath) {
    console.warn("[prospection-annuaire-sante] aucun fichier RPPS (PROSPECTION_RPPS_PATH) → no-op");
    return { skipped: "no-file" as const };
  }
  const { retentionYears } = await getProspectionConfig("retention");
  const separator = process.env.PROSPECTION_RPPS_SEPARATOR;
  // ingestAnnuaireSante throw si le flag AIPD n'est pas activé (garde-fou).
  const summary = await ingestAnnuaireSante(
    new LocalFileAnnuaireSanteSource(rppsPath, separator ? { separator } : {}),
    prisma,
    { retentionYears },
  );
  console.log("[prospection-annuaire-sante] terminé", summary);
  return summary;
}

export function startProspectionAnnuaireSanteWorker(): Worker<ProspectionAnnuaireSanteJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionAnnuaireSanteJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-annuaire-sante", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
