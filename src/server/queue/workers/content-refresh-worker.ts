/**
 * Worker content refresh mensuel (Sprint v7 Phase 13).
 *
 * Mission : maintenir la "freshness" des Articles publiés > 90 jours en
 * mettant à jour leur date de modification + en flaggant ceux dont les
 * impressions GSC chutent (signal Google reranking nécessite refresh).
 *
 * V1 squelette structurel. Sessions 10+ implémenteront :
 *   - Fetch impressions GSC pour articles > 90j via gsc-client.ts existant
 *   - Détection delta -50% impressions → flag `needs_refresh`
 *   - Re-run quality-improver-worker sur articles flaggés (LLM judge feedback)
 *   - Update Article.updatedAt + ping IndexNow/Google Indexing API
 *
 * Activation V1 : env CONTENT_REFRESH_ENABLED=true. Désactivé par défaut.
 * Cron mensuel suggéré : 1er du mois 04h00 UTC.
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "content-refresh";

interface RefreshJobData {
  readonly trigger: "cron-monthly" | "manual";
  readonly olderThanDays?: number; // default 90
}

export interface ContentRefreshResult {
  readonly scannedCount: number;
  readonly flaggedCount: number;
  readonly refreshedCount: number;
  readonly checkedAt: string;
}

const ENABLED_ENV = process.env.CONTENT_REFRESH_ENABLED === "true";

async function runRefreshJob(_job: Job<RefreshJobData>): Promise<ContentRefreshResult> {
  if (!ENABLED_ENV) {
    console.log("[content-refresh] disabled (env CONTENT_REFRESH_ENABLED!=true) — skip");
    return {
      scannedCount: 0,
      flaggedCount: 0,
      refreshedCount: 0,
      checkedAt: new Date().toISOString(),
    };
  }
  // V1 stub : à compléter Sessions 10+ avec :
  //  1. Query Prisma Article.findMany({ where: { status: "published", updatedAt: { lte: NOW - 90d } } })
  //  2. Pour chaque article : fetch GSC impressions delta vs N-1 mois
  //  3. Si delta < -50% : enqueue dans content-gen queue avec improvementFeedback="freshness"
  //  4. Update Article.updatedAt après successful refresh
  //  5. Ping IndexNow + Google Indexing API
  console.log("[content-refresh] V1 stub — GSC integration + refresh logic reportée Session 10+");
  return {
    scannedCount: 0,
    flaggedCount: 0,
    refreshedCount: 0,
    checkedAt: new Date().toISOString(),
  };
}

let workerInstance: Worker<RefreshJobData> | null = null;

export function startContentRefreshWorker(): Worker<RefreshJobData> {
  if (!ENABLED_ENV) {
    throw new Error("CONTENT_REFRESH_ENABLED!=true — worker NOT started (env-gated)");
  }
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-refresh-worker cannot start");
  workerInstance = new Worker<RefreshJobData>(QUEUE_NAME, runRefreshJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 1_800_000, // 30 min (cron mensuel long-running)
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-refresh-worker] job ${job?.id} failed:`, err);
    captureWorkerError("content-refresh", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopContentRefreshWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

export { runRefreshJob as runContentRefreshJob };
export { QUEUE_NAME as CONTENT_REFRESH_QUEUE_NAME };
