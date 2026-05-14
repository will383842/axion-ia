/**
 * Content Generator — Quality improver worker (§ 27 v1.7).
 *
 * Picks ContentGenJob avec `status='quality_improving'` (positionné par le
 * worker primaire `content-gen-worker` quand score < seuil). Re-prompte
 * sections ciblées + ré-évalue qualité. Si nouveau score >= target → bascule
 * `needs_review`. Sinon increment `qualityImprovementAttempts`, et au-delà du
 * cap configuré → bascule `failed` avec error doctrine.
 *
 * V1 = skeleton functional. Pipeline complet (re-prompt LLM avec system
 * prompt enrichi sections sous-performantes) arrive V2 quand on a un dataset
 * pour identifier patterns de re-prompt utiles.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

const QUEUE_NAME = "content-quality-improver";

export interface QualityImproveJobPayload {
  readonly contentGenJobId: string;
  readonly previousScore: number;
}

interface QualityLoopSettings {
  readonly enabled: boolean;
  readonly minScoreThreshold: number;
  readonly targetScore: number;
  readonly maxAttemptsAuto: number;
  readonly monthlyBudgetCapUsd: number;
}

async function processJob(job: Job<QualityImproveJobPayload>): Promise<void> {
  const { contentGenJobId, previousScore } = job.data;

  // Kill switch hard-gate (P1-7 fix audit opérationnel 2026-05-14).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(`[quality-improver-worker] kill switch active, requeue job ${contentGenJobId}`);
    throw new Error("kill_switch_active");
  }

  const settings = await readContentGenConfig<QualityLoopSettings>("quality_loop", {
    enabled: true,
    minScoreThreshold: 75,
    targetScore: 85,
    maxAttemptsAuto: 2,
    monthlyBudgetCapUsd: 100,
  });

  if (!settings.enabled) {
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: { status: "needs_review" },
    });
    return;
  }

  const dbJob = await prisma.contentGenJob.findUnique({ where: { id: contentGenJobId } });
  if (!dbJob) throw new Error(`ContentGenJob ${contentGenJobId} not found`);

  if (dbJob.qualityImprovementAttempts >= settings.maxAttemptsAuto) {
    // Cap atteint → bascule needs_review pour décision manuelle Will
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: { status: "needs_review" },
    });
    await prisma.generationLog.create({
      data: {
        jobId: contentGenJobId,
        level: "warn",
        step: "quality_loop_cap_reached",
        message: `Cap auto ${settings.maxAttemptsAuto} atteint (score ${previousScore}). Manual review.`,
      },
    });
    return;
  }

  // V1 = increment attempts + log. V2 = re-prompt LLM avec system prompt
  // enrichi (sections sous-score identifiées via heuristique on body).
  await prisma.contentGenJob.update({
    where: { id: contentGenJobId },
    data: {
      status: "needs_review",
      qualityImprovementAttempts: { increment: 1 },
    },
  });
  await prisma.generationLog.create({
    data: {
      jobId: contentGenJobId,
      level: "info",
      step: "quality_loop_pass",
      message: `Pass quality loop ${dbJob.qualityImprovementAttempts + 1}/${settings.maxAttemptsAuto}, ancien score ${previousScore}`,
    },
  });
}

let workerInstance: Worker<QualityImproveJobPayload> | null = null;

export function startQualityImproverWorker(): Worker<QualityImproveJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL not set — content-quality-improver-worker cannot start");
  }
  workerInstance = new Worker<QualityImproveJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-quality-improver-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopQualityImproverWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
