/**
 * Content Generator — BullMQ worker (Sprint 2 AGT-H).
 *
 * V1 = squelette. Pipeline (§ 13.1 master prompt + § 25.3) :
 *
 * 1. Job arrive sur queue `content-gen`
 * 2. Lookup ContentGenJob DB → status running
 * 3. Hard gate KB ready (kb-health.assertKbReady)
 * 4. Pre-IA dedup-guard check (4 couches v1.7)
 * 5. Resolve generator via getGenerator(contentType)
 * 6. Call generator.generate(input) → GeneratorOutput
 * 7. Post-process : Q/R extraction (enqueue 8 micro-jobs qa_extract_and_publish)
 * 8. Insert Article DB tier_2_noindex_follow par défaut (review-queue)
 * 9. Update ContentGenJob status → needs_review
 * 10. Publish Telegram alert (§ 12.3bis)
 *
 * Concurrency 5 par defaut (config DB ContentGenConfig.workers_concurrency).
 * Rate-limit 10/min (alignée OpenAI tier 5).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getGenerator } from "@/server/content-gen/generators";
import { assertKbReady, KbNotReadyError } from "@/server/content-gen/kb-health";
import { checkDedup } from "@/server/content-gen/quality/dedup-guard";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";

const QUEUE_NAME = "content-gen";

export interface ContentGenJobPayload {
  readonly contentGenJobId: string;
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly inputPayload: Record<string, unknown>;
}

async function processJob(job: Job<ContentGenJobPayload>): Promise<void> {
  const { contentGenJobId, contentType, targetSearchIntent, inputPayload } = job.data;

  // 1. Lookup ContentGenJob DB
  const dbJob = await prisma.contentGenJob.findUnique({ where: { id: contentGenJobId } });
  if (!dbJob) {
    throw new Error(`ContentGenJob ${contentGenJobId} not found`);
  }

  // 2. Hard gate KB ready
  try {
    await assertKbReady();
  } catch (err) {
    if (err instanceof KbNotReadyError) {
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: { status: "failed", errorMessage: err.message },
      });
      return;
    }
    throw err;
  }

  // 3. Status → running + dedup pre-IA
  await prisma.contentGenJob.update({
    where: { id: contentGenJobId },
    data: { status: "running", startedAt: new Date() },
  });

  const title = typeof inputPayload["title"] === "string" ? inputPayload["title"] : "";
  if (title) {
    const dedup = await checkDedup({
      title,
      ...(typeof inputPayload["primaryKeyword"] === "string"
        ? { primaryKeyword: inputPayload["primaryKeyword"] }
        : {}),
      ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
      ...(dbJob.targetAudienceSize ? { targetAudienceSize: dbJob.targetAudienceSize } : {}),
      ...(dbJob.targetAudienceOrganisation
        ? { targetAudienceOrganisation: dbJob.targetAudienceOrganisation }
        : {}),
    });
    if (!dedup.passed) {
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: {
          status: "cancelled",
          errorMessage: `Dedup pre-IA: ${dedup.reason ?? "unknown"}`,
        },
      });
      return;
    }
  }

  // 4. Resolve generator + generate
  const generator = getGenerator(contentType);
  try {
    const startedAt = Date.now();
    const output = await generator.generate({
      jobId: contentGenJobId,
      contentType,
      targetSearchIntent,
      ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
      ...(dbJob.anchorDepartementCode
        ? { anchorDepartementCode: dbJob.anchorDepartementCode }
        : {}),
      ...(dbJob.anchorRegionSlug ? { anchorRegionSlug: dbJob.anchorRegionSlug } : {}),
      ...(dbJob.targetAudienceSize ? { targetAudienceSize: dbJob.targetAudienceSize } : {}),
      ...(dbJob.targetAudienceOrganisation
        ? { targetAudienceOrganisation: dbJob.targetAudienceOrganisation }
        : {}),
      ...(typeof inputPayload["primaryKeyword"] === "string"
        ? { primaryKeyword: inputPayload["primaryKeyword"] }
        : {}),
    });

    // 5. Update job + persist outputs (Sprint 2 Day 5 — Article DB row insert)
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: {
        status: "needs_review",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        qualityScore: output.qualityScore,
        seoScore: output.seoScore,
        readabilityScore: output.readabilityScore,
        tokensInput: 0, // détaillé via CostLedger
        tokensOutput: output.totalTokens,
        costUsd: output.totalCostUsd,
      },
    });

    // 6. TODO Sprint 2 Day 6 — hook qa_extract_and_publish (8 micro-jobs)
    // 7. TODO Sprint 2 Day 7 — Telegram alert "Nouveau contenu en review"
  } catch (err) {
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

let workerInstance: Worker<ContentGenJobPayload> | null = null;

/**
 * Démarre le worker BullMQ (V1 concurrency 5 hardcoded — V2 DB-managed).
 * À appeler depuis `src/server/queue/index.ts` au démarrage de l'app.
 */
export function startContentGenWorker(): Worker<ContentGenJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL not set — content-gen-worker cannot start");
  }
  workerInstance = new Worker<ContentGenJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 5,
    limiter: { max: 10, duration: 60_000 }, // 10/min — alignée OpenAI tier 5
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-gen-worker] job ${job?.id} failed:`, err);
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-gen-worker] job ${job.id} completed`);
  });
  return workerInstance;
}

export async function stopContentGenWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
