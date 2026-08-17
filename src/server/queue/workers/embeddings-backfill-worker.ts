/**
 * Embeddings Backfill Worker — Phase F Sprint Perfection 2026.
 *
 * Cron quotidien 03:00 UTC.
 * Backfille les embeddings OpenAI (text-embedding-3-large, 1536 dims) sur les
 * articles publiés sans embedding (couche 4 dédup sémantique pipeline B.7).
 *
 * Limites :
 * - MAX_ARTICLES_PER_RUN = 1000 articles/exécution (évite OOM + rate-limit)
 * - Respecte le cap journalier OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY
 * - Gate OPENAI_EMBEDDINGS_ENABLED=true obligatoire (défaut false)
 *
 * Coût estimé : ~$0.09 pour 1 000 articles
 * (text-embedding-3-large, dimensions=1536, ~695 tokens/article moyen)
 *
 * Traçabilité :
 * - ContentGenConfig key="embeddings_daily_cost_usd" : coût accumulé du run
 * - ContentGenConfig key="embeddings_last_run" : ISO timestamp + stats du dernier run
 */

import { Worker, type Job } from "bullmq";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { readKillSwitchFailSafe } from "@/server/content-gen/config-store";

export const EMBEDDINGS_BACKFILL_QUEUE = "embeddings-backfill";

const QUEUE_NAME = EMBEDDINGS_BACKFILL_QUEUE;
const BATCH_SIZE = 20; // 20 articles/batch — respecte rate limits OpenAI tier-1
const MAX_ARTICLES_PER_RUN = 1000;

// ~0.13 $ / million tokens text-embedding-3-large (tarif 2026)
const COST_PER_TOKEN_USD = 0.00000013;
const AVG_TOKENS_PER_ARTICLE = 695;

interface ArticleRow {
  id: string;
  title: string;
  content: string | null;
}

interface RunStats {
  processed: number;
  skipped: number;
  errors: number;
  estimatedCostUsd: number;
  totalArticlesWithoutEmbedding: number;
  durationMs: number;
}

/** Tronque le texte pour éviter de dépasser ~8000 tokens OpenAI (~32k chars). */
function buildEmbeddingText(title: string, content: string | null): string {
  const body = content?.slice(0, 6000) ?? "";
  return `${title}\n\n${body}`;
}

async function runBackfill(_job: Job): Promise<RunStats> {
  const startMs = Date.now();

  if (process.env.OPENAI_EMBEDDINGS_ENABLED !== "true") {
    const stats: RunStats = {
      processed: 0,
      skipped: 0,
      errors: 0,
      estimatedCostUsd: 0,
      totalArticlesWithoutEmbedding: 0,
      durationMs: Date.now() - startMs,
    };
    await prisma.contentGenConfig.upsert({
      where: { key: "embeddings_last_run" },
      create: {
        key: "embeddings_last_run",
        value: {
          skippedReason: "OPENAI_EMBEDDINGS_ENABLED=false",
          at: new Date().toISOString(),
          ...stats,
        },
      },
      update: {
        value: {
          skippedReason: "OPENAI_EMBEDDINGS_ENABLED=false",
          at: new Date().toISOString(),
          ...stats,
        },
      },
    });
    return stats;
  }

  // Fix 2026-08-15 (audit e2e, F8) — ce worker fait des appels OpenAI PAYANTS
  // sans jamais consulter le kill switch global content-gen (seul le flag env
  // OPENAI_EMBEDDINGS_ENABLED le gatait). Un arrêt d'urgence — par exemple
  // l'auto-arrêt du quota-guard sur compte OpenAI à sec — laissait donc ce cron
  // quotidien continuer à dépenser (ou à échouer bruyamment sur le même compte
  // à sec). Même motif que les autres workers : skip PROPRE (pas d'échec, trace
  // dans embeddings_last_run), lecture fail-safe (DB illisible = arrêt).
  const killSwitch = await readKillSwitchFailSafe();
  if (killSwitch.active) {
    const stats: RunStats = {
      processed: 0,
      skipped: 0,
      errors: 0,
      estimatedCostUsd: 0,
      totalArticlesWithoutEmbedding: 0,
      durationMs: Date.now() - startMs,
    };
    console.warn(
      `[embeddings-backfill] kill switch actif (${killSwitch.reason ?? "sans raison"}) — skip run`,
    );
    await prisma.contentGenConfig.upsert({
      where: { key: "embeddings_last_run" },
      create: {
        key: "embeddings_last_run",
        value: {
          skippedReason: `kill_switch actif : ${killSwitch.reason ?? "sans raison"}`,
          at: new Date().toISOString(),
          ...stats,
        },
      },
      update: {
        value: {
          skippedReason: `kill_switch actif : ${killSwitch.reason ?? "sans raison"}`,
          at: new Date().toISOString(),
          ...stats,
        },
      },
    });
    return stats;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("[embeddings-backfill] OPENAI_API_KEY manquante");
  }

  const openai = new OpenAI({ apiKey });

  const maxTokensPerDay = parseInt(
    process.env.OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY ?? "1000000",
    10,
  );

  // Récupérer les articles publiés sans embedding (ORDER BY published_at DESC).
  // Prisma ne supporte pas le filtrage IS NULL sur Unsupported("vector") →
  // on passe par $queryRawUnsafe (cohérent avec backfill-embeddings.ts).
  const articles = (await prisma.$queryRawUnsafe(
    `SELECT a.id, t.title, t.content
     FROM articles a
     LEFT JOIN article_translations t ON t.article_id = a.id AND t.locale = 'fr'
     WHERE a.status = 'published'
       AND a.embedding IS NULL
     ORDER BY a.published_at DESC NULLS LAST
     LIMIT ${MAX_ARTICLES_PER_RUN}`,
  )) as ArticleRow[];

  const totalArticlesWithoutEmbedding = articles.length;

  if (articles.length === 0) {
    const stats: RunStats = {
      processed: 0,
      skipped: 0,
      errors: 0,
      estimatedCostUsd: 0,
      totalArticlesWithoutEmbedding: 0,
      durationMs: Date.now() - startMs,
    };
    await prisma.contentGenConfig.upsert({
      where: { key: "embeddings_last_run" },
      create: {
        key: "embeddings_last_run",
        value: { at: new Date().toISOString(), nothingToDo: true, ...stats },
      },
      update: {
        value: { at: new Date().toISOString(), nothingToDo: true, ...stats },
      },
    });
    return stats;
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let tokensUsed = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    // Rate-limit quotidien : on arrête si dépassement estimé.
    const estimatedTokensSoFar = (processed + skipped) * AVG_TOKENS_PER_ARTICLE;
    if (estimatedTokensSoFar >= maxTokensPerDay) {
      break;
    }

    const batch = articles.slice(i, i + BATCH_SIZE);
    const validBatch = batch.filter((a) => a.title?.trim());
    skipped += batch.length - validBatch.length;

    if (validBatch.length === 0) continue;

    let batchEmbeddings: number[][] | null = null;
    try {
      const texts = validBatch.map((a) => buildEmbeddingText(a.title, a.content));
      const response = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: texts,
        dimensions: 1536,
      });
      batchEmbeddings = response.data.map((d) => d.embedding);
      tokensUsed += response.usage?.total_tokens ?? validBatch.length * AVG_TOKENS_PER_ARTICLE;
    } catch (err) {
      // Si une erreur OpenAI se produit sur le batch → on log + continue (partial success).
      errors += validBatch.length;
      console.error(
        `[embeddings-backfill] Erreur OpenAI batch ${i + 1}-${Math.min(i + BATCH_SIZE, articles.length)}:`,
        err instanceof Error ? err.message : String(err),
      );
      continue;
    }

    // Upsert embedding article par article.
    for (let j = 0; j < validBatch.length; j++) {
      const article = validBatch[j];
      if (!article) continue;
      const embeddingVector = batchEmbeddings[j];
      if (!embeddingVector) {
        errors++;
        continue;
      }

      try {
        const vectorLiteral = `[${embeddingVector.join(",")}]`;
        await prisma.$executeRaw`
          UPDATE articles
          SET embedding = ${vectorLiteral}::vector
          WHERE id = ${article.id}::uuid
        `;
        processed++;
      } catch (writeErr) {
        errors++;
        console.error(
          `[embeddings-backfill] Erreur écriture embedding article ${article.id}:`,
          writeErr instanceof Error ? writeErr.message : String(writeErr),
        );
      }
    }

    // Pause 1s entre batches pour respecter les rate limits OpenAI (3 000 RPM tier-1).
    if (i + BATCH_SIZE < articles.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
  }

  const estimatedCostUsd = tokensUsed * COST_PER_TOKEN_USD;
  const durationMs = Date.now() - startMs;

  const stats: RunStats = {
    processed,
    skipped,
    errors,
    estimatedCostUsd,
    totalArticlesWithoutEmbedding,
    durationMs,
  };

  // Persistance des métriques dans ContentGenConfig.
  await Promise.all([
    prisma.contentGenConfig.upsert({
      where: { key: "embeddings_daily_cost_usd" },
      create: { key: "embeddings_daily_cost_usd", value: estimatedCostUsd },
      update: { value: estimatedCostUsd },
    }),
    prisma.contentGenConfig.upsert({
      where: { key: "embeddings_last_run" },
      create: {
        key: "embeddings_last_run",
        value: { at: new Date().toISOString(), ...stats },
      },
      update: {
        value: { at: new Date().toISOString(), ...stats },
      },
    }),
  ]);

  return stats;
}

let workerInstance: Worker | null = null;

export function startEmbeddingsBackfillWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — embeddings-backfill-worker cannot start");

  workerInstance = new Worker(QUEUE_NAME, runBackfill, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 120_000,
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 14 },
  });

  workerInstance.on("failed", (job, err) => {
    captureWorkerError("embeddings-backfill", QUEUE_NAME, job, err);
    console.error(`[embeddings-backfill-worker] job ${job?.id} failed:`, err);
  });

  return workerInstance;
}

export async function stopEmbeddingsBackfillWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
