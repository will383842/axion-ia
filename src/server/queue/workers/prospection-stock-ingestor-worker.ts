/**
 * Worker — Ingestion du Stock Sirene (prospection T3).
 *
 * Consomme la file `prospection-stock-ingestor`. Stub-aware (early-exit au build
 * `stub.invalid`). Le fichier Stock (téléchargé par l'ops ou monté sur volume)
 * est référencé par chemin (job data ou env). Aucun appel réseau ici : la source
 * est un fichier local (`LocalFileStockSource`) → 0 dépendance à un SIREN réel
 * pour construire/tester le pipeline.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { ingestSireneStock } from "@/server/prospection/sources/sirene-stock-ingestor";
import { getProspectionConfig } from "@/server/prospection/config/site-settings";
import { LocalFileStockSource, isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionStockIngestJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-stock-ingestor";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";

let workerInstance: Worker<ProspectionStockIngestJobData> | null = null;

async function processJob(job: Job<ProspectionStockIngestJobData>) {
  if (isBuildStub()) {
    console.warn("[prospection-stock-ingestor] stub.invalid → skip");
    return { skipped: "stub" as const };
  }
  const uniteLegale = job.data.uniteLegalePath ?? process.env.PROSPECTION_STOCK_UNITE_LEGALE_PATH;
  const etablissement =
    job.data.etablissementPath ?? process.env.PROSPECTION_STOCK_ETABLISSEMENT_PATH;

  if (!uniteLegale && !etablissement) {
    console.warn(
      "[prospection-stock-ingestor] aucun fichier Stock configuré (job data ou PROSPECTION_STOCK_*_PATH) → no-op",
    );
    return { skipped: "no-file" as const };
  }

  const source = new LocalFileStockSource({ uniteLegale, etablissement });
  const { retentionYears } = await getProspectionConfig("retention");
  const summary = await ingestSireneStock(source, prisma, { retentionYears });
  console.log("[prospection-stock-ingestor] terminé", summary);
  return summary;
}

export function startProspectionStockIngestorWorker(): Worker<ProspectionStockIngestJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionStockIngestJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1, // ingest lourd : un seul à la fois
    lockDuration: 3_600_000, // 1 h (bulk-load long)
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-stock-ingestor", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
