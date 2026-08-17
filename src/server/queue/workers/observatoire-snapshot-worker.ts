/**
 * Observatoire IA 2026 — worker d'AUTO-UPDATE.
 *
 * Cron (queues.ts) : toutes les 6 h. À chaque tick :
 *   1. recalcule `BarometerSnapshot("latest")` + breakdowns segments + historise
 *      (alimente les courbes d'évolution) ;
 *   2. régénère la synthèse LLM `BarometerAnalysis` UNIQUEMENT si l'effectif réel
 *      a changé depuis la dernière analyse (économie de tokens) ;
 *   3. purge le cache Cloudflare des pages observatoire (best-effort, gated env)
 *      pour que les nouveaux chiffres soient servis sans attendre le TTL edge.
 *
 * Sans ce worker, le snapshot public ne se met à jour que sur clic admin
 * « Recalculer le snapshot ». Idempotent (recompute = upsert ; analyse skip si
 * effectif inchangé). Ne tourne jamais au build (process worker séparé).
 */

import { Worker, type Job } from "bullmq";
import { recomputeAndPersistSnapshot } from "@/server/observatoire/snapshot";
import { generateAndPersistAnalysis } from "@/server/observatoire/analysis";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { purgerEdge } from "@/server/cache/revalidate-and-purge";

export const QUEUE_NAME = "observatoire-snapshot";

interface ObservatoireSnapshotJobPayload {
  tick: string;
}

/**
 * Purge le cache CF des URLs observatoire (best-effort, no-op si secrets absents).
 *
 * Ce worker était le SEUL endroit du dépôt sachant purger l'edge — une purge de
 * deux URLs codées en dur, pendant qu'aucune publication de contenu n'en
 * déclenchait (GEO-120). Le code a été généralisé dans `@/server/cache` ; on
 * l'appelle ici plutôt que d'entretenir une seconde implémentation qui
 * divergerait au premier correctif.
 */
async function purgeObservatoireCache(): Promise<void> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com").replace(/\/$/, "");
  await purgerEdge([`${site}/fr/observatoire-ia`, `${site}/fr/presse`], "observatoire-snapshot");
}

async function processJob(job: Job<ObservatoireSnapshotJobPayload>): Promise<void> {
  console.log(`[observatoire-snapshot] tick=${job.data.tick} → recompute snapshot`);
  const snap = await recomputeAndPersistSnapshot();
  console.log(`[observatoire-snapshot] snapshot total=${snap.totalResponses}`);

  const analysis = await generateAndPersistAnalysis();
  if (analysis.ok) {
    console.log(
      `[observatoire-snapshot] analysis ${analysis.regenerated ? "regenerated" : "unchanged"} (based on ${analysis.basedOnTotal})`,
    );
  } else {
    console.log(`[observatoire-snapshot] analysis skipped: ${analysis.reason}`);
  }

  await purgeObservatoireCache();
}

let workerInstance: Worker<ObservatoireSnapshotJobPayload> | null = null;

export function startObservatoireSnapshotWorker(): Worker<ObservatoireSnapshotJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — observatoire-snapshot-worker cannot start");
  workerInstance = new Worker<ObservatoireSnapshotJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 300_000, // 5 min — l'appel LLM peut être lent.
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[observatoire-snapshot-worker] job ${job?.id} failed:`, err);
    captureWorkerError("observatoire-snapshot", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopObservatoireSnapshotWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
