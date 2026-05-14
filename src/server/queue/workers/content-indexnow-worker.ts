/**
 * Content Generator — IndexNow ping worker (§ 9bis.1 master prompt v1.7).
 *
 * Pingé après chaque publication tier-1 par `content-publish-worker` (Sprint 5+).
 * V1 = endpoint POST direct vers api.indexnow.org. Pas de batching V1 — chaque
 * publication déclenche son propre ping (volume V1 < 100/jour OK).
 *
 * Volume V2 (industrialisation 2150 villes) : passer en batch quotidien 02:00
 * via cron + sitemap diff. Le worker existant `scripts/indexnow-ping.ts` couvre
 * déjà le batch postbuild ; ce worker BullMQ couvre l'événementiel temps réel.
 *
 * Variables d'env nécessaires :
 *   - INDEXNOW_KEY (32 chars min)
 *   - NEXT_PUBLIC_SITE_URL (https://axion-ia.com)
 *
 * No-op silencieux si l'une des deux est manquante.
 */

import { Worker, type Job } from "bullmq";
import { buildIndexNowPayload } from "@/lib/seo-content-gen-factories";

const QUEUE_NAME = "content-indexnow";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export interface IndexNowJobPayload {
  readonly urls: ReadonlyArray<string>;
  readonly origin: "content-gen" | "manual" | "cron";
}

async function processJob(job: Job<IndexNowJobPayload>): Promise<void> {
  const { urls, origin } = job.data;
  const key = process.env.INDEXNOW_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!key || !siteUrl) {
    console.warn(
      `[indexnow-worker] skipped (origin=${origin}, ${urls.length} urls) — INDEXNOW_KEY or NEXT_PUBLIC_SITE_URL missing`,
    );
    return;
  }
  if (urls.length === 0) return;

  // Filter URLs : doit appartenir au siteUrl host
  const host = new URL(siteUrl).host;
  const validUrls = urls.filter((u) => {
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  });
  if (validUrls.length === 0) {
    console.warn(`[indexnow-worker] no valid urls for host ${host}`);
    return;
  }

  const payload = buildIndexNowPayload(validUrls);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok && res.status !== 202) {
      console.warn(`[indexnow-worker] HTTP ${res.status} on ${validUrls.length} urls`);
      return;
    }
    console.log(
      `[indexnow-worker] OK ${validUrls.length} urls pinged (origin=${origin}, status=${res.status})`,
    );
  } catch (err) {
    // IndexNow down ne doit pas faire échouer une publication
    console.warn(`[indexnow-worker] error:`, err);
  } finally {
    clearTimeout(timeout);
  }
}

let workerInstance: Worker<IndexNowJobPayload> | null = null;

export function startIndexNowWorker(): Worker<IndexNowJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — indexnow-worker cannot start");
  workerInstance = new Worker<IndexNowJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 2,
    limiter: { max: 30, duration: 60_000 }, // 30/min — IndexNow rate-limit safe
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-indexnow-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopIndexNowWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
