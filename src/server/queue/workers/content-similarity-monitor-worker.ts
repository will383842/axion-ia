/**
 * Content Generator — Similarity monitor worker (§ 25.5 couche C v1.7).
 *
 * Cron quotidien 04:30 UTC. Scanne les articles tier-1 + tier-2 publiés
 * récemment (30 derniers jours) et calcule pour chaque paire :
 *  - Jaccard token similarity sur titres (rapide, déterministe)
 *  - Cosine sur embeddings KB (si VOYAGE_API_KEY dispo, sinon skip)
 *
 * Stocke les top 100 paires en ContentGenConfig.key="similarity_pairs"
 * (transitoire V1 — V1.5 table SimilarityPair dédiée).
 *
 * Bulk actions (archiver / fusionner / ignorer) restent UI-driven via
 * /similarity-monitor admin (Sprint 5).
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { prisma } from "@/lib/prisma";
import {
  readContentGenConfig,
  writeContentGenConfig,
} from "@/server/actions/content-gen/_settings";

const QUEUE_NAME = "content-similarity-monitor";

interface SimilarityPair {
  readonly jobIdA: string;
  readonly jobIdB: string;
  readonly contentTypeA: string;
  readonly contentTypeB: string;
  readonly titleA: string;
  readonly titleB: string;
  readonly anchorVilleA: string | null;
  readonly anchorVilleB: string | null;
  readonly jaccard: number;
  readonly detectedAt: string;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Kill switch hard-gate (P1-7 fix audit opérationnel 2026-05-14).
  // Le similarity-monitor lit/écrit le corpus existant — neutral mais on coupe
  // par cohérence (audit batch global Will).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log("[similarity-monitor-worker] kill switch active, skip tick");
    return;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.contentGenJob.findMany({
    where: {
      status: "published",
      completedAt: { gte: thirtyDaysAgo },
    },
    select: {
      id: true,
      contentType: true,
      anchorVilleSlug: true,
      outputJsonRaw: true,
    },
    take: 2000,
  });

  // Extract titre from outputJsonRaw (Generator output shape)
  const docs: Array<{
    readonly id: string;
    readonly contentType: string;
    readonly anchorVilleSlug: string | null;
    readonly title: string;
    readonly tokens: Set<string>;
  }> = [];

  for (const j of jobs) {
    const raw = j.outputJsonRaw as { title?: string } | null;
    const title = typeof raw?.title === "string" ? raw.title : "";
    if (title.length < 5) continue;
    docs.push({
      id: j.id,
      contentType: j.contentType,
      anchorVilleSlug: j.anchorVilleSlug,
      title,
      tokens: tokenize(title),
    });
  }

  // Compare toutes paires (O(n²) — OK jusqu'à ~2000 docs sur cron 24h)
  const pairs: SimilarityPair[] = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i]!;
      const b = docs[j]!;
      const score = jaccard(a.tokens, b.tokens);
      if (score >= 0.5) {
        pairs.push({
          jobIdA: a.id,
          jobIdB: b.id,
          contentTypeA: a.contentType,
          contentTypeB: b.contentType,
          titleA: a.title,
          titleB: b.title,
          anchorVilleA: a.anchorVilleSlug,
          anchorVilleB: b.anchorVilleSlug,
          jaccard: score,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  }

  pairs.sort((p1, p2) => p2.jaccard - p1.jaccard);
  const top100 = pairs.slice(0, 100);

  await writeContentGenConfig(
    "similarity_pairs",
    top100,
    "similarity-monitor-worker",
    `Top ${top100.length}/100 paires similaires détectées (Jaccard >= 0.5)`,
  );

  console.log(
    `[similarity-monitor] scanned ${docs.length} docs, ${pairs.length} pairs >= 0.5 Jaccard, top 100 stored.`,
  );
}

let workerInstance: Worker | null = null;

export function startSimilarityMonitorWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — similarity-monitor cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[similarity-monitor] job ${job?.id} failed:`, err);
    captureWorkerError("similarity-monitor", QUEUE_NAME, job, err);
  });
  return workerInstance;
}

export async function stopSimilarityMonitorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
