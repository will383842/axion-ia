/**
 * Worker — Collecte d'une cellule (prospection T4).
 *
 * Compte les entreprises prospectables de la cellule (backbone Stock déjà
 * ingéré), décide `fait|erreur` (exhaustivité), enfile l'enrichissement.
 * `limiter` BullMQ = garde-fou DUR du débit (Redis-coordonné). Stub-aware.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { collectCell, type CollectDb } from "@/server/prospection/collect/collect-cell";
import { enqueueProspectionEnrich } from "@/server/prospection/queue/queues";
import { isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionCollectJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-collect";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";
let workerInstance: Worker<ProspectionCollectJobData> | null = null;

async function processJob(job: Job<ProspectionCollectJobData>) {
  if (isBuildStub()) return { skipped: "stub" as const };
  const cell = await prisma.prospectionCoverageCell.findUnique({
    where: { id: job.data.cellId },
    include: { campaign: true },
  });
  if (!cell) return { skipped: "not-found" as const };

  const result = await collectCell(
    prisma as unknown as CollectDb,
    {
      id: cell.id,
      departement: cell.departement,
      naf: cell.naf,
      taille: cell.taille,
      attendu: cell.attendu,
    },
    {
      enrichirContacts: cell.campaign.enrichirContacts,
      enqueueEnrich: enqueueProspectionEnrich,
    },
  );
  return result;
}

export function startProspectionCollectWorker(): Worker<ProspectionCollectJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionCollectJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 4,
    // Garde-fou DUR de débit (Redis-coordonné, cf. resilience/token-bucket-redis).
    limiter: { max: 100, duration: 1000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-collect", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
