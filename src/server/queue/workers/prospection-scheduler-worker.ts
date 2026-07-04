/**
 * Worker — Scheduler de campagnes (prospection T4).
 *
 * Cron court : active les campagnes dues (`nextRunAt <= now`), ordonnées par
 * priorité, en enfilant l'orchestrateur. Backpressure : borne le nombre de
 * campagnes activées par tick. Stub-aware. Recurrence avancée = T6/T9.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { enqueueProspectionOrchestrator } from "@/server/prospection/queue/queues";
import { isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionSchedulerJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-scheduler";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";
const MAX_PER_TICK = 5;
let workerInstance: Worker<ProspectionSchedulerJobData> | null = null;

async function processJob(_job: Job<ProspectionSchedulerJobData>) {
  if (isBuildStub()) return { skipped: "stub" as const };
  const now = new Date();
  const due = await prisma.prospectionCampaign.findMany({
    where: { nextRunAt: { not: null, lte: now }, statut: { notIn: ["terminee"] } },
    orderBy: [{ priorite: "desc" }, { nextRunAt: "asc" }],
    take: MAX_PER_TICK,
    select: { id: true },
  });
  for (const c of due) {
    await enqueueProspectionOrchestrator(c.id);
    // One-shot : on retire nextRunAt (l'avance par récurrence cron = T6).
    await prisma.prospectionCampaign.update({ where: { id: c.id }, data: { nextRunAt: null } });
  }
  return { activated: due.length };
}

export function startProspectionSchedulerWorker(): Worker<ProspectionSchedulerJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionSchedulerJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-scheduler", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
