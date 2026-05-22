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
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { redis } from "@/lib/redis";
import { alertIndexNowFailStreak } from "@/server/content-gen/shared/content-gen-alerts";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "content-indexnow";
const ENDPOINT = "https://api.indexnow.org/indexnow";

// Audit indexation 2026-05-15 P0-10 — compteur Redis fail streak.
// Clé : `indexnow:fail-streak` (TTL 1h). À chaque fail upstream → INCR + TTL refresh.
// Sur succès → DEL. Alerte Telegram déclenchée à 3, 10, 30 fails (escalade).
const FAIL_STREAK_KEY = "indexnow:fail-streak";
const FAIL_STREAK_TTL_SEC = 3600;
const FAIL_STREAK_ALERT_THRESHOLDS = new Set<number>([3, 10, 30]);

async function recordIndexNowFail(reason: string): Promise<void> {
  try {
    const count = await redis.incr(FAIL_STREAK_KEY);
    if (count === 1) {
      await redis.expire(FAIL_STREAK_KEY, FAIL_STREAK_TTL_SEC);
    }
    if (FAIL_STREAK_ALERT_THRESHOLDS.has(count)) {
      await alertIndexNowFailStreak(count, reason);
    }
  } catch (err) {
    console.warn(
      "[indexnow-worker] recordIndexNowFail redis op failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function resetIndexNowFailStreak(): Promise<void> {
  try {
    await redis.del(FAIL_STREAK_KEY);
  } catch {
    // best-effort
  }
}

export interface IndexNowJobPayload {
  readonly urls: ReadonlyArray<string>;
  readonly origin: "content-gen" | "manual" | "cron";
}

async function processJob(job: Job<IndexNowJobPayload>): Promise<void> {
  const { urls, origin } = job.data;

  // Audit 2026-05-15 P1-8 — kill-switch check (évite ping IndexNow sur
  // contenus que Will a paused, propage le signal de pause aux moteurs).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(
      `[indexnow-worker] kill switch active, skip ${urls.length} urls (origin=${origin})`,
    );
    return;
  }

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
      const reason = `HTTP ${res.status} on ${validUrls.length} urls`;
      console.warn(`[indexnow-worker] ${reason}`);
      // Audit indexation 2026-05-15 P0-10 — track fail streak + alerte Telegram.
      await recordIndexNowFail(reason);
      return;
    }
    console.log(
      `[indexnow-worker] OK ${validUrls.length} urls pinged (origin=${origin}, status=${res.status})`,
    );
    // Succès → reset le streak counter
    await resetIndexNowFailStreak();
  } catch (err) {
    // IndexNow down ne doit pas faire échouer une publication
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[indexnow-worker] error:`, err);
    await recordIndexNowFail(reason);
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
    lockDuration: 120_000,
    limiter: { max: 30, duration: 60_000 }, // 30/min — IndexNow rate-limit safe
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-indexnow-worker] job ${job?.id} failed:`, err);
    // Sprint S+4-C (audit content-gen deep 2026-05-18 P1-7) — Sentry capture.
    // Le worker absorbe déjà la majorité des fails upstream via try/catch
    // interne (recordIndexNowFail + alertIndexNowFailStreak Telegram), mais
    // les exceptions hors-pipeline (kill switch read, payload malformed,
    // BullMQ retry exhausted) tombent ici. Sentry permet de séparer ces
    // causes infra des fails IndexNow fonctionnels (déjà tracés Redis).
    captureWorkerError("indexnow", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopIndexNowWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
