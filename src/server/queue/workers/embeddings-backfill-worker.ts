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
import { alerterSiCreditOpenAiEpuise } from "@/server/notifications/openai-credit-alert";
import {
  buildEmbeddingInput,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL_NAME,
  generateEmbedding,
} from "@/lib/knowledge/embeddings";

import { embedVoyageBatch } from "@/server/content-gen/dedup/voyage-embedder";
import { buildVoyageEmbeddingText } from "@/server/content-gen/dedup/texte-a-vectoriser";

export const EMBEDDINGS_BACKFILL_QUEUE = "embeddings-backfill";

const QUEUE_NAME = EMBEDDINGS_BACKFILL_QUEUE;
const BATCH_SIZE = 20; // 20 articles/batch — respecte rate limits OpenAI tier-1
const MAX_ARTICLES_PER_RUN = 1000;

// ~0.13 $ / million tokens text-embedding-3-large (tarif 2026)
const COST_PER_TOKEN_USD = 0.00000013;
const AVG_TOKENS_PER_ARTICLE = 695;

// Recalcul des vecteurs de la base de connaissances (Voyage, quelques centimes par passage).
const MAX_KB_VECTORS_PER_RUN = 600;
const KB_PAUSE_MS = 250;

// Rattrapage Voyage des articles (PR4) : lots de 20, plafond par passage.
const VOYAGE_BATCH_SIZE = 20;
const VOYAGE_DEFAULT_MAX_PER_RUN = 500;
const VOYAGE_HARD_MAX_PER_RUN = 2000;
const VOYAGE_PAUSE_MS = 300;
const VOYAGE_MAX_CONSECUTIVE_FAILURES = 3;

interface ArticleRow {
  id: string;
  title: string;
  content: string | null;
}

interface ArticleVoyageRow {
  id: string;
  title: string;
  meta_description: string | null;
  body_text: string | null;
  body: string | null;
}

function texteVoyage(a: ArticleVoyageRow): string {
  return buildVoyageEmbeddingText({
    title: a.title,
    metaDescription: a.meta_description,
    bodyText: a.body_text,
    bodyHtml: a.body,
  });
}

interface KbStaleRow {
  translation_id: string;
  title: string;
  excerpt: string | null;
  body_text: string | null;
  body: string | null;
}

export interface KbRefreshStats {
  refreshed: number;
  errors: number;
  candidates: number;
  skippedReason?: string;
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

/** Retire les balises HTML d'un corps de fiche quand `body_text` est vide. */
function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recalcule les vecteurs de la base de connaissances (Voyage, 1024 dim) dont la fiche a été
 * modifiée APRÈS le dernier calcul (`knowledge_translations.updated_at > knowledge_embeddings.embedded_at`).
 * Sans cela, une fiche corrigée garde le vecteur de son ancien texte et la recherche
 * remonte l'ancienne version.
 *
 * - UPDATE de la ligne existante : jamais de DELETE, jamais de nouvelle ligne.
 * - Aucune clé Voyage, ou vecteur stub (non sémantique) : on ne touche à rien.
 * - Seules les fiches publiques partent chez Voyage (confidentialité).
 */
export async function rafraichirVecteursKbPerimes(): Promise<KbRefreshStats> {
  const saute = async (skippedReason: string): Promise<KbRefreshStats> => ({
    refreshed: 0,
    errors: 0,
    candidates: 0,
    skippedReason,
  });

  if (!process.env.VOYAGE_API_KEY) return saute("VOYAGE_API_KEY absente");
  const killSwitch = await readKillSwitchFailSafe();
  if (killSwitch.active) return saute("kill switch actif");

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT kt.id AS translation_id, kt.title, kt.excerpt, kt.body_text, kt.body
     FROM knowledge_embeddings kemb
     JOIN knowledge_translations kt ON kt.id = kemb.translation_id
     JOIN knowledge_entries ke ON ke.id = kt.entry_id
     WHERE kt.updated_at > kemb.embedded_at
       AND ke.deleted_at IS NULL
       AND ke.confidentiality = 'public'
     ORDER BY kt.updated_at ASC
     LIMIT ${MAX_KB_VECTORS_PER_RUN}`,
  )) as KbStaleRow[];

  let refreshed = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const texte = buildEmbeddingInput({
        title: row.title,
        excerpt: row.excerpt,
        bodyText: row.body_text?.trim() ? row.body_text : htmlToText(row.body ?? ""),
      });
      const emb = await generateEmbedding(texte);
      if (emb.modelVersion.endsWith("-stub")) {
        // Garde anti-stub : mieux vaut un vecteur périmé qu'un faux vecteur.
        return { refreshed, errors, candidates: rows.length, skippedReason: "vecteur stub" };
      }
      await prisma.$executeRawUnsafe(
        `UPDATE knowledge_embeddings
         SET embedding = $1::vector, model = $2, model_version = $3, dimensionality = $4, embedded_at = NOW()
         WHERE translation_id = $5::uuid`,
        `[${emb.embedding.join(",")}]`,
        EMBEDDING_MODEL_NAME,
        emb.modelVersion,
        EMBEDDING_DIMENSION,
        row.translation_id,
      );
      refreshed++;
    } catch (err) {
      errors++;
      console.error(
        `[embeddings-backfill] recalcul vecteur KB ${row.translation_id} en échec:`,
        err instanceof Error ? err.message : String(err),
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, KB_PAUSE_MS));
  }
  return { refreshed, errors, candidates: rows.length };
}

export interface VoyageBackfillStats {
  processed: number;
  skipped: number;
  errors: number;
  candidates: number;
  skippedReason?: string;
  stoppedReason?: string;
}

function plafondVoyageParPassage(): number {
  const n = parseInt(process.env.VOYAGE_BACKFILL_MAX_PER_RUN ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return VOYAGE_DEFAULT_MAX_PER_RUN;
  return Math.min(n, VOYAGE_HARD_MAX_PER_RUN);
}

async function ecrireEmbeddingVoyage(
  articleId: string,
  vecteur: readonly number[],
  stats: VoyageBackfillStats,
): Promise<void> {
  try {
    const litteral = `[${vecteur.join(",")}]`;
    await prisma.$executeRaw`
      UPDATE articles
      SET embedding_voyage = ${litteral}::vector
      WHERE id = ${articleId}::uuid
        AND embedding_voyage IS NULL
    `;
    stats.processed++;
  } catch (err) {
    stats.errors++;
    console.error(
      `[embeddings-backfill] écriture embedding_voyage article ${articleId} en échec:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Rattrapage de `articles.embedding_voyage` (Voyage voyage-3, 1024 dim) sur les articles
 * publiés qui n'en ont pas. Indépendant de CONTENT_EMBEDDING_PROVIDER : il doit pouvoir
 * tourner AVANT la bascule (runbook R36). Allumé uniquement par
 * `VOYAGE_ARTICLES_BACKFILL_ENABLED=true` ET `VOYAGE_API_KEY` : par défaut, rien ne part.
 *
 * - Par lots de 20, plafond par passage (500 par défaut, 2000 max).
 * - Kill switch respecté (lecture fail-safe).
 * - 429 : on s'arrête (le lendemain reprend où on en était, la colonne NULL fait foi).
 * - Ne lève jamais : une panne Voyage laisse les colonnes NULL, rien d'autre.
 */
export async function rattraperEmbeddingsVoyage(): Promise<VoyageBackfillStats> {
  const vide = (skippedReason: string): VoyageBackfillStats => ({
    processed: 0,
    skipped: 0,
    errors: 0,
    candidates: 0,
    skippedReason,
  });
  if (process.env.VOYAGE_ARTICLES_BACKFILL_ENABLED !== "true") {
    return vide("VOYAGE_ARTICLES_BACKFILL_ENABLED != true");
  }
  if (!process.env.VOYAGE_API_KEY) return vide("VOYAGE_API_KEY absente");
  const killSwitch = await readKillSwitchFailSafe();
  if (killSwitch.active) return vide("kill switch actif");

  const max = plafondVoyageParPassage();
  const articles = (await prisma.$queryRawUnsafe(
    `SELECT a.id, t.title, t.meta_description, t.body_text, t.body
     FROM articles a
     JOIN article_translations t ON t.article_id = a.id AND t.locale = 'fr'
     WHERE a.status = 'published'
       AND a.embedding_voyage IS NULL
       AND btrim(COALESCE(t.title, '')) <> ''
     ORDER BY a.published_at DESC NULLS LAST
     LIMIT ${max}`,
  )) as ArticleVoyageRow[];

  const stats: VoyageBackfillStats = {
    processed: 0,
    skipped: 0,
    errors: 0,
    candidates: articles.length,
  };
  let echecsConsecutifs = 0;

  for (let i = 0; i < articles.length; i += VOYAGE_BATCH_SIZE) {
    const lot = articles.slice(i, i + VOYAGE_BATCH_SIZE);
    const out = await embedVoyageBatch(lot.map(texteVoyage));
    if (!out.ok) {
      // 4xx (hors 429) sur un lot de plusieurs articles : un seul article fautif le fait
      // échouer chaque nuit. On réessaie article par article et on saute celui qui échoue.
      const status = out.status;
      if (out.reason === "http_error" && (status === 401 || status === 403)) {
        // Clé refusée : inutile de réessayer article par article (rafale d'appels).
        stats.errors += lot.length;
        stats.stoppedReason = "auth";
        break;
      }
      if (
        out.reason === "http_error" &&
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        lot.length > 1
      ) {
        let unSeulOk = false;
        for (const article of lot) {
          const seul = await embedVoyageBatch([texteVoyage(article)]);
          if (seul.ok && seul.embeddings[0]) {
            unSeulOk = true;
            await ecrireEmbeddingVoyage(article.id, seul.embeddings[0], stats);
          } else if (!seul.ok && (seul.reason === "rate_limited" || seul.reason === "no_key")) {
            stats.errors++;
            stats.stoppedReason = seul.reason;
            return stats;
          } else {
            stats.errors++;
            console.error(
              `[embeddings-backfill] article ${article.id} sauté : Voyage le refuse (HTTP ${status}).`,
            );
          }
          await new Promise<void>((resolve) => setTimeout(resolve, VOYAGE_PAUSE_MS));
        }
        // Un lot où plus aucun article ne passe est une vraie panne : il compte comme échec.
        echecsConsecutifs = unSeulOk ? 0 : echecsConsecutifs + 1;
        if (echecsConsecutifs >= VOYAGE_MAX_CONSECUTIVE_FAILURES) {
          stats.stoppedReason = `${echecsConsecutifs} lots consécutifs en échec (${out.reason})`;
          break;
        }
        continue;
      }
      stats.errors += lot.length;
      echecsConsecutifs++;
      if (out.reason === "rate_limited" || out.reason === "no_key") {
        stats.stoppedReason = out.reason;
        break;
      }
      if (echecsConsecutifs >= VOYAGE_MAX_CONSECUTIVE_FAILURES) {
        stats.stoppedReason = `${echecsConsecutifs} lots consécutifs en échec (${out.reason})`;
        break;
      }
      continue;
    }
    echecsConsecutifs = 0;

    for (let j = 0; j < lot.length; j++) {
      const article = lot[j];
      const vecteur = out.embeddings[j];
      if (!article || !vecteur) {
        stats.errors++;
        continue;
      }
      await ecrireEmbeddingVoyage(article.id, vecteur, stats);
    }
    if (i + VOYAGE_BATCH_SIZE < articles.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, VOYAGE_PAUSE_MS));
    }
  }
  return stats;
}

async function rattraperVoyageSansEchec(): Promise<void> {
  try {
    const stats = await rattraperEmbeddingsVoyage();
    // On ne date que les passages qui ont eu du travail (pas de bruit quand tout est éteint).
    if (stats.candidates > 0) {
      await prisma.contentGenConfig.upsert({
        where: { key: "embeddings_voyage_last_run" },
        create: {
          key: "embeddings_voyage_last_run",
          value: { at: new Date().toISOString(), ...stats },
        },
        update: { value: { at: new Date().toISOString(), ...stats } },
      });
    }
  } catch (err) {
    // Une panne du rattrapage Voyage ne doit jamais faire échouer le passage.
    console.error(
      "[embeddings-backfill] rattrapage Voyage en échec:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Passage de 03 h : vecteurs des articles (OpenAI), rattrapage Voyage, puis vecteurs périmés de la base (Voyage). */
async function runBackfill(job: Job): Promise<RunStats> {
  try {
    return await runBackfillArticles(job);
  } finally {
    await rattraperVoyageSansEchec();
    // Même si la partie articles échoue (clé OpenAI absente...), la base est recalculée.
    await rafraichirBaseSansEchec();
  }
}

async function rafraichirBaseSansEchec(): Promise<void> {
  try {
    const kb = await rafraichirVecteursKbPerimes();
    if (kb.candidates > 0 || kb.skippedReason !== "VOYAGE_API_KEY absente") {
      await prisma.contentGenConfig.upsert({
        where: { key: "embeddings_kb_last_run" },
        create: { key: "embeddings_kb_last_run", value: { at: new Date().toISOString(), ...kb } },
        update: { value: { at: new Date().toISOString(), ...kb } },
      });
    }
  } catch (err) {
    // Le recalcul de la base ne doit jamais faire échouer le passage des articles.
    console.error(
      "[embeddings-backfill] recalcul des vecteurs KB en échec:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function runBackfillArticles(_job: Job): Promise<RunStats> {
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
    // `article_translations` n'a pas de colonne `content` : le texte est `body_text`
    // (texte brut), ou `body` quand `body_text` est vide. Alias `content` conservé.
    `SELECT a.id, t.title, COALESCE(NULLIF(t.body_text, ''), t.body) AS content
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
      // Crédit épuisé / facturation refusée : prévient le fondateur (anti-doublon 6 h).
      if (err instanceof Error) {
        const e = err as Error & { status?: number; type?: string; code?: string };
        await alerterSiCreditOpenAiEpuise({
          status: e.status,
          type: e.type,
          code: e.code,
          message: e.message,
        });
      }
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
