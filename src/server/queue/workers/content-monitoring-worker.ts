/**
 * Content monitoring worker — Méta-cert 2026-05-15 AGENT 19 P1.
 *
 * Câble 3 helpers Telegram ready-to-call déclarés dans
 * `content-gen-alerts.ts` mais jamais invoqués jusqu'ici :
 *
 *  1. `alertQueueStuck(queueName, waitingCount, minutesStuck)` —
 *     inspecte BullMQ `getWaitingCount()` sur les queues critiques et
 *     compare avec la valeur snapshot précédente stockée dans
 *     `ContentGenConfig.queue_stuck_snapshots`. Si même count > 30 min
 *     sans progression → alerte.
 *
 *  2. `alertSoft404Detected(slug, reason)` — link-checker daily-ish (les
 *     hourly runs ne checkent qu'un sample 10 URLs random tier_1 pour ne
 *     pas saturer). HEAD request → soft-404 = 200 avec body anormalement
 *     court (template vide / page de redirection silencieuse).
 *
 *  3. `alertIndexationStagnant(slugs, daysSincePublish)` — détecte Articles
 *     tier_1_indexable publiés ≥ 30 j sans `gscIndexedAt` set (signe
 *     d'absence d'indexation Google malgré ping IndexNow + sitemap).
 *
 * Cron pattern : `15 * * * *` (xx:15 every hour). Décalé d'autres crons
 * pour ne pas concentrer la charge.
 *
 * Fail-soft : chaque check est dans son try/catch. Une erreur sur queueStuck
 * n'empêche pas soft404 + indexationStagnant de tourner.
 *
 * Note V1.5 — `alertProviderDown5min/30min` non câblé ici : nécessite un
 * compteur fail-counter dans le call provider lui-même (cost-tracker ou
 * IProvider wrapper), pas un cron périodique. Sprint dédié.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  alertQueueStuck,
  alertSoft404Detected,
  alertIndexationStagnant,
} from "@/server/content-gen/shared/content-gen-alerts";
import { ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";

const QUEUE_NAME = "content-monitoring";

/** Queues critiques à monitorer (waiting count stable > 30 min = stuck). */
const MONITORED_QUEUES: ReadonlyArray<string> = [
  "content-gen",
  "content-publish",
  "content-orchestrator",
  "emails",
];

/** Seuil de stagnation queue : > 30 min sans progression. */
const QUEUE_STUCK_MINUTES = 30;

/** Sample size soft-404 par run (HEAD checks). */
const SOFT404_SAMPLE_SIZE = 10;

/** Body length threshold sous lequel on flagge soft-404 (HTML vide / template). */
const SOFT404_BODY_MIN_BYTES = 2000;

/** Seuil indexation stagnante : Article tier_1 publié ≥ 30 j sans gscIndexedAt. */
const INDEXATION_STAGNANT_DAYS = 30;

/** Cap nombre d'articles flag pour alerte (pour ne pas spammer). */
const INDEXATION_STAGNANT_MAX_LIST = 5;

interface QueueSnapshot {
  readonly count: number;
  readonly capturedAt: string; // ISO
}

/**
 * Snapshots persistés dans Redis sous `axion:monitoring:queue-snapshot:<queueName>`.
 * TTL 3 h (assez pour traverser 2 cycles cron sans expirer + auto-cleanup).
 * Évite d'écrire dans `ContentGenConfig` qui exige `requireAdmin()` (incompat worker).
 */
const SNAPSHOT_TTL_SECONDS = 3 * 3600;
const SNAPSHOT_KEY_PREFIX = "axion:monitoring:queue-snapshot:";

async function checkQueueStuck(): Promise<void> {
  const Redis = (await import("ioredis")).default;
  const url = process.env.REDIS_URL;
  if (!url) return;
  const redis = new Redis(url, { maxRetriesPerRequest: 1, enableReadyCheck: false });

  try {
    const now = new Date();
    for (const queueName of MONITORED_QUEUES) {
      try {
        // BullMQ stocke les jobs waiting dans la liste `bull:<queue>:wait`.
        const count = await redis.llen(`bull:${queueName}:wait`);
        const snapshotKey = `${SNAPSHOT_KEY_PREFIX}${queueName}`;
        const prevJson = await redis.get(snapshotKey);
        const previous: QueueSnapshot | null = prevJson
          ? (JSON.parse(prevJson) as QueueSnapshot)
          : null;
        if (previous && previous.count === count && count > 0) {
          const previousAt = new Date(previous.capturedAt);
          const minutesStuck = Math.floor((now.getTime() - previousAt.getTime()) / 60_000);
          if (minutesStuck >= QUEUE_STUCK_MINUTES) {
            await alertQueueStuck(queueName, count, minutesStuck);
            // Reset le snapshot pour éviter de spammer une alerte chaque heure.
            const next: QueueSnapshot = { count, capturedAt: now.toISOString() };
            await redis.set(snapshotKey, JSON.stringify(next), "EX", SNAPSHOT_TTL_SECONDS);
            continue;
          }
          // Pas encore stuck — on garde le snapshot d'origine pour suivre la durée.
          continue;
        }
        const next: QueueSnapshot = { count, capturedAt: now.toISOString() };
        await redis.set(snapshotKey, JSON.stringify(next), "EX", SNAPSHOT_TTL_SECONDS);
      } catch (err) {
        console.warn(`[content-monitoring] queueStuck check failed for ${queueName}:`, err);
      }
    }
  } finally {
    redis.disconnect();
  }
}

async function checkSoft404(): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  // Article.slug n'existe pas directement — c'est dans `ArticleTranslation`
  // par locale. On lookup les translations FR (canonique) d'Articles tier_1.
  const candidates = await prisma.articleTranslation.findMany({
    where: {
      locale: "fr",
      article: {
        status: "published",
        indexationTier: "tier_1_indexable",
      },
    },
    select: {
      slug: true,
      article: { select: { isNews: true } },
    },
    take: SOFT404_SAMPLE_SIZE * 3, // sample-then-shuffle pour randomness léger
  });
  if (candidates.length === 0) return;

  // Shuffle Fisher-Yates puis prend SOFT404_SAMPLE_SIZE premiers.
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i];
    const swap = shuffled[j];
    if (tmp && swap) {
      shuffled[i] = swap;
      shuffled[j] = tmp;
    }
  }
  const sample = shuffled.slice(0, SOFT404_SAMPLE_SIZE);

  for (const t of sample) {
    const segment = t.article.isNews ? "actualites" : "blog";
    const url = `${siteUrl}/fr/${segment}/${t.slug}`;
    try {
      const res = await ssrfSafeFetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue; // 4xx/5xx ≠ soft-404, c'est un hard error géré ailleurs
      const text = await res.text();
      if (text.length < SOFT404_BODY_MIN_BYTES) {
        await alertSoft404Detected(t.slug, `body too short (${text.length} bytes)`);
      }
    } catch {
      // fail-soft — timeout, DNS, etc. ne déclenchent pas l'alerte.
    }
  }
}

async function checkIndexationStagnant(): Promise<void> {
  // Heuristique V1 sans field `gscIndexedAt` dédié : un Article tier_1
  // publié ≥ 30 j sans AUCUN row `KeywordTracking` correspondant via articleId
  // est suspect — soit non indexé Google, soit 0 impression.
  // V1.5 ajoutera `Article.gscIndexedAt` pour un signal plus fin.
  const threshold = new Date(Date.now() - INDEXATION_STAGNANT_DAYS * 86_400_000);
  const candidates = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: "tier_1_indexable",
      publishedAt: { lte: threshold },
    },
    select: {
      id: true,
      publishedAt: true,
      translations: { where: { locale: "fr" }, select: { slug: true }, take: 1 },
    },
    orderBy: { publishedAt: "asc" },
    take: 50, // cap large puis filter local
  });
  if (candidates.length === 0) return;

  const stagnant: Array<{ slug: string; publishedAt: Date }> = [];
  for (const article of candidates) {
    if (stagnant.length >= INDEXATION_STAGNANT_MAX_LIST) break;
    const trackingCount = await prisma.keywordTracking.count({
      where: { articleId: article.id },
    });
    const slug = article.translations[0]?.slug;
    if (trackingCount === 0 && article.publishedAt && slug) {
      stagnant.push({ slug, publishedAt: article.publishedAt });
    }
  }
  if (stagnant.length === 0) return;
  // `alertIndexationStagnant(slug, ctrPct, ageDays, impressions)` attend 1 slug
  // par appel. CTR + impressions = 0 placeholder car GSC integration V1.5
  // fournira les vrais chiffres. V1 = simple detection "tier-1 sans KeywordTracking".
  for (const s of stagnant) {
    const daysSince = Math.floor((Date.now() - s.publishedAt.getTime()) / 86_400_000);
    await alertIndexationStagnant(s.slug, 0, daysSince, 0);
  }
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // 3 checks en parallèle (Promise.allSettled pour ne pas qu'un fail bloque les autres).
  await Promise.allSettled([checkQueueStuck(), checkSoft404(), checkIndexationStagnant()]);
}

let workerInstance: Worker | null = null;

export function startContentMonitoringWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — content-monitoring-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-monitoring-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopContentMonitoringWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
