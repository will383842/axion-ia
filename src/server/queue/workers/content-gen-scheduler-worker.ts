/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.2
 *
 * Scheduler worker — Cron every-5-min (pattern: "* /5 * * * *", no space).
 *
 * Scanne les campagnes `scheduled` dont `startDate <= NOW()` et les
 * passe en `running + startedAt = NOW()`.
 *
 * Ce worker est le pendant côté worker du `scheduleCampaign()` Server Action.
 * L'orchestrateur principal (content-orchestrator-worker) prend ensuite le relais
 * à son prochain tick (15 min max) pour enqueue les ContentGenJob.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "content-gen-scheduler";

async function processJob(): Promise<void> {
  const now = new Date();

  // Scanne les campagnes scheduled dont startDate <= NOW()
  const toActivate = await prisma.coverageCampaign.findMany({
    where: {
      status: "scheduled",
      startDate: { lte: now },
    },
    select: { id: true, name: true },
  });

  if (toActivate.length === 0) {
    return;
  }

  for (const campaign of toActivate) {
    await prisma.coverageCampaign.update({
      where: { id: campaign.id },
      data: { status: "running", startedAt: now },
    });
    console.log(
      `[content-gen-scheduler] campaign=${campaign.id} (${campaign.name}) scheduled → running at ${now.toISOString()}`,
    );
  }

  console.log(`[content-gen-scheduler] activated ${toActivate.length} campaign(s)`);
}

let workerInstance: Worker | null = null;

export function startContentGenSchedulerWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-gen-scheduler-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-gen-scheduler-worker] job ${job?.id} failed:`, err);
    captureWorkerError("content-gen-scheduler", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopContentGenSchedulerWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
