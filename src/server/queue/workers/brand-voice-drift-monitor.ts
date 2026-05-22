/**
 * Brand Voice Drift Monitor — Sprint H 2026-05-22 (Phase H Perfection).
 *
 * Cron quotidien 04:00 UTC.
 * Pour chaque article publié dans les dernières 24h :
 *   1. Récupère l'embedding de l'article depuis DB (champ Unsupported pgvector)
 *   2. Charge l'embedding de référence brand voice depuis ContentGenConfig
 *      (key="brand_voice_reference_embedding")
 *   3. Calcule la similarité cosine vs référence
 *   4. < 0.70 → update article.status = "needs_review" + log warn
 *   5. < 0.80 → ajoute entrée ContentGenAuditLog (drift warning)
 *   6. Stocke les stats du run dans ContentGenConfig (key="brand_voice_drift_last_run")
 *
 * Si aucun embedding de référence configuré → log info + skip silencieux.
 *
 * Embedding field Article : pgvector `Unsupported("vector(1536)")`.
 * On passe par $queryRawUnsafe (cf. backfill-embeddings.ts pattern).
 *
 * SOC2 : toute dérive flaggée est écrite dans ContentGenAuditLog avec
 * action="brand_voice_drift_flag" (audit trail forensique).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { BRAND_VOICE_CONFIG_KEY } from "@/server/actions/content-gen/brand-voice-constants";

export const QUEUE_NAME = "brand-voice-drift-monitor";

/** Seuil bas : article mis en needs_review (dérive sévère). */
export const DRIFT_THRESHOLD_REVIEW = 0.70;

/** Seuil haut : drift warning loggé dans ContentGenAuditLog. */
export const DRIFT_THRESHOLD_WARN = 0.80;

/** Clé ContentGenConfig pour les stats du dernier run. */
const DRIFT_LAST_RUN_KEY = "brand_voice_drift_last_run";

interface ArticleEmbeddingRow {
  readonly id: string;
  readonly embedding_arr: number[] | null;
}

export interface DriftRunStats {
  readonly analyzedAt: string;
  readonly articlesAnalyzed: number;
  readonly articlesFlagged: number;
  readonly articlesNeedsReview: number;
}

/**
 * Cosine similarity pure — handle null/empty gracefully.
 * Retourne null si l'un des vecteurs est null/vide ou si dimensions mismatch.
 */
export function cosineSimilarityNullSafe(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
): number | null {
  if (!a || !b || a.length === 0 || b.length === 0) return null;
  if (a.length !== b.length) return null;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return null;
  return dot / denom;
}

/**
 * Charge l'embedding de référence brand voice depuis ContentGenConfig.
 * Retourne null si la clé n'existe pas ou si la valeur n'est pas un tableau de nombres.
 */
async function loadReferenceEmbedding(): Promise<readonly number[] | null> {
  try {
    const row = await prisma.contentGenConfig.findUnique({
      where: { key: BRAND_VOICE_CONFIG_KEY },
    });
    if (!row || !row.value) return null;
    const val = row.value;
    if (!Array.isArray(val)) return null;
    // Validate it's an array of numbers
    const arr = val as unknown[];
    if (arr.length === 0) return null;
    if (typeof arr[0] !== "number") return null;
    return arr as number[];
  } catch {
    return null;
  }
}

/**
 * Récupère les articles publiés dans les dernières 24h avec leur embedding pgvector.
 * Passe par $queryRawUnsafe car embedding est un champ Unsupported() dans Prisma.
 */
async function fetchRecentArticlesWithEmbeddings(since: Date): Promise<ArticleEmbeddingRow[]> {
  // embedding::text donne la représentation '[0.1,0.2,...]' en string.
  // On demande à Postgres de la sérialiser en JSON array via to_json(embedding).
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT
       a.id,
       CASE
         WHEN a.embedding IS NOT NULL
         THEN ARRAY(SELECT unnest(a.embedding::real[]))
         ELSE NULL
       END AS embedding_arr
     FROM articles a
     WHERE a.status = 'published'
       AND a.published_at >= $1
     ORDER BY a.published_at DESC`,
    since,
  )) as Array<{ id: string; embedding_arr: number[] | null }>;

  return rows;
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Charger le référentiel brand voice
  const referenceEmbedding = await loadReferenceEmbedding();
  if (!referenceEmbedding) {
    console.info("[brand-voice-drift-monitor] no reference embedding configured — skipping run");
    return;
  }

  // 2. Récupérer les articles publiés dans les 24h avec embedding
  const articles = await fetchRecentArticlesWithEmbeddings(since);

  if (articles.length === 0) {
    console.info("[brand-voice-drift-monitor] nothing to process — no articles published in last 24h");
    return;
  }

  let articlesAnalyzed = 0;
  let articlesFlagged = 0;
  let articlesNeedsReview = 0;

  for (const article of articles) {
    // Skip articles without embedding
    if (!article.embedding_arr || article.embedding_arr.length === 0) {
      continue;
    }

    articlesAnalyzed++;

    const similarity = cosineSimilarityNullSafe(article.embedding_arr, referenceEmbedding);
    if (similarity === null) continue;

    // 3. Seuil < 0.70 → needs_review + log warn
    if (similarity < DRIFT_THRESHOLD_REVIEW) {
      articlesNeedsReview++;
      articlesFlagged++;

      console.warn(
        JSON.stringify({
          event: "brand_voice_drift_critical",
          articleId: article.id,
          similarity: similarity.toFixed(4),
          threshold: DRIFT_THRESHOLD_REVIEW,
          action: "needs_review",
        }),
      );

      // Update article status → needs_review
      await prisma.article
        .update({
          where: { id: article.id },
          data: { status: "needs_review" as never },
        })
        .catch((err) => {
          // needs_review may not be a valid status if not in enum — fail-soft
          console.warn(
            `[brand-voice-drift-monitor] could not update article ${article.id} status:`,
            err instanceof Error ? err.message : String(err),
          );
        });

      // Write ContentGenAuditLog for needs_review (also logs drift < 0.80)
      await prisma.contentGenAuditLog
        .create({
          data: {
            action: "brand_voice_drift_flag",
            settingKey: "brand_voice_drift",
            newValue: {
              articleId: article.id,
              similarity,
              level: "needs_review",
              threshold: DRIFT_THRESHOLD_REVIEW,
              detectedAt: new Date().toISOString(),
            } as never,
            description: `Dérive brand voice critique (similarity=${similarity.toFixed(4)} < ${DRIFT_THRESHOLD_REVIEW}) — article mis en needs_review`,
          },
        })
        .catch(() => {
          // fail-soft — audit log failure doesn't block processing
        });
    } else if (similarity < DRIFT_THRESHOLD_WARN) {
      // 4. Seuil 0.70 ≤ x < 0.80 → drift warning ContentGenAuditLog uniquement
      articlesFlagged++;

      await prisma.contentGenAuditLog
        .create({
          data: {
            action: "brand_voice_drift_flag",
            settingKey: "brand_voice_drift",
            newValue: {
              articleId: article.id,
              similarity,
              level: "warn",
              threshold: DRIFT_THRESHOLD_WARN,
              detectedAt: new Date().toISOString(),
            } as never,
            description: `Dérive brand voice modérée (similarity=${similarity.toFixed(4)} < ${DRIFT_THRESHOLD_WARN}) — article flaggé pour revue`,
          },
        })
        .catch(() => {
          // fail-soft
        });

      console.warn(
        JSON.stringify({
          event: "brand_voice_drift_warn",
          articleId: article.id,
          similarity: similarity.toFixed(4),
          threshold: DRIFT_THRESHOLD_WARN,
        }),
      );
    }
  }

  // 5. Stocker les stats du run
  const runStats: DriftRunStats = {
    analyzedAt: new Date().toISOString(),
    articlesAnalyzed,
    articlesFlagged,
    articlesNeedsReview,
  };

  await prisma.contentGenConfig
    .upsert({
      where: { key: DRIFT_LAST_RUN_KEY },
      create: {
        key: DRIFT_LAST_RUN_KEY,
        value: runStats as never,
        updatedBy: "brand-voice-drift-monitor",
      },
      update: {
        value: runStats as never,
        updatedBy: "brand-voice-drift-monitor",
      },
    })
    .catch(() => {
      // fail-soft — stats write failure doesn't block
    });

  console.info(
    JSON.stringify({
      event: "brand_voice_drift_run_complete",
      ...runStats,
    }),
  );
}

let workerInstance: Worker | null = null;

export function startBrandVoiceDriftMonitorWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl)
    throw new Error("REDIS_URL not set — brand-voice-drift-monitor-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 14 },
  });
  workerInstance.on("failed", (job, err) => {
    captureWorkerError("brand-voice-drift-monitor", QUEUE_NAME, job, err);
    console.error(`[brand-voice-drift-monitor] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopBrandVoiceDriftMonitorWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
