/**
 * Worker GSC HCU monitoring quotidien (Sprint v7 Phase 9).
 *
 * Surveille les URLs indexées vs deindexées sur Google Search Console pour
 * détecter une régression HCU (Helpful Content Update 2024-2026) sur le
 * domaine. Si déindexation soudaine > 5%, lève une alerte Telegram + Sentry.
 *
 * V1 = squelette structurel. La connexion GSC OAuth réelle + parsing API
 * URL Inspection sont reportées Sessions 10+ (env vars GSC_REFRESH_TOKEN +
 * GSC_SITE_URL à configurer Coolify avant activation).
 *
 * Activation V1 : feature flag env GSC_HCU_MONITOR_ENABLED=true. Désactivé
 * par défaut pour ne pas appeler GSC API sans clés valides en dev.
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "gsc-hcu-monitor";

interface MonitorJobData {
  readonly trigger: "cron-daily" | "manual";
  readonly siteUrl?: string;
}

export interface GscHcuMonitorResult {
  readonly indexedCount: number;
  readonly notIndexedCount: number;
  readonly deindexedDelta: number;
  readonly thresholdExceeded: boolean;
  readonly checkedAt: string;
}

const ENABLED_ENV = process.env.GSC_HCU_MONITOR_ENABLED === "true";
const DEINDEX_THRESHOLD_PCT = 5; // 5% deindexation/jour = alerte

/**
 * Exécution réelle GSC API. V1 squelette : retourne stub data.
 * Session 10+ : intégration via @googleapis/searchconsole + OAuth refresh
 * (cf `src/server/clients/gsc-client.ts` existant pour le pattern).
 */
async function runMonitorJob(_job: Job<MonitorJobData>): Promise<GscHcuMonitorResult> {
  if (!ENABLED_ENV) {
    console.log("[gsc-hcu-monitor] disabled (env GSC_HCU_MONITOR_ENABLED!=true) — skip");
    return {
      indexedCount: 0,
      notIndexedCount: 0,
      deindexedDelta: 0,
      thresholdExceeded: false,
      checkedAt: new Date().toISOString(),
    };
  }
  // V1 stub : retourne 0/0 sans appel GSC réel. Session 10+ remplacera.
  console.log("[gsc-hcu-monitor] V1 stub — GSC API integration reportée Session 10+");
  return {
    indexedCount: 0,
    notIndexedCount: 0,
    deindexedDelta: 0,
    thresholdExceeded: false,
    checkedAt: new Date().toISOString(),
  };
}

let workerInstance: Worker<MonitorJobData> | null = null;

export function startGscHcuMonitorWorker(): Worker<MonitorJobData> {
  if (!ENABLED_ENV) {
    throw new Error("GSC_HCU_MONITOR_ENABLED!=true — worker NOT started (env-gated)");
  }
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — gsc-hcu-monitor-worker cannot start");
  workerInstance = new Worker<MonitorJobData>(QUEUE_NAME, runMonitorJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 300_000, // 5 min (GSC API peut être lent)
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[gsc-hcu-monitor-worker] job ${job?.id} failed:`, err);
    captureWorkerError("gsc-hcu-monitor", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopGscHcuMonitorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

/**
 * Export pour tests + run manuel.
 */
export { runMonitorJob as runGscHcuMonitorJob };
export { QUEUE_NAME as GSC_HCU_MONITOR_QUEUE_NAME };
export { DEINDEX_THRESHOLD_PCT };
