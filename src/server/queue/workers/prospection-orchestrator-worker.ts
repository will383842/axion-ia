/**
 * Worker — Orchestrateur de campagne (prospection T4).
 * Détend la campagne en cellules et enfile la collecte. Stub-aware.
 */

import { Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import {
  orchestrateCampaign,
  type OrchestratorDb,
} from "@/server/prospection/collect/orchestrator";
import { enqueueProspectionCollect } from "@/server/prospection/queue/queues";
import { isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionOrchestratorJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-orchestrator";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";
let workerInstance: Worker<ProspectionOrchestratorJobData> | null = null;

async function processJob(job: Job<ProspectionOrchestratorJobData>) {
  if (isBuildStub()) return { skipped: "stub" as const };
  const campaign = await prisma.prospectionCampaign.findUnique({
    where: { id: job.data.campaignId },
  });
  if (!campaign) {
    console.warn(`[prospection-orchestrator] campagne ${job.data.campaignId} introuvable`);
    return { skipped: "not-found" as const };
  }
  const result = await orchestrateCampaign(
    prisma as unknown as OrchestratorDb,
    {
      id: campaign.id,
      departements: campaign.departements,
      secteurs: campaign.secteurs,
      nafCodes: campaign.nafCodes,
      tailles: campaign.tailles,
      toutesActivites: campaign.toutesActivites,
    },
    {
      enqueueCollect: enqueueProspectionCollect,
      genRunId: () => randomUUID(),
      quotaMax: campaign.quotaMax ?? 0,
    },
  );
  console.log("[prospection-orchestrator] terminé", result);
  return result;
}

export function startProspectionOrchestratorWorker(): Worker<ProspectionOrchestratorJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionOrchestratorJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 2,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-orchestrator", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
