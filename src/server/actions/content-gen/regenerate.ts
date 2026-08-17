/**
 * Content Generator — Régénération EN PLACE d'un article existant (2026-06-22).
 *
 * Objectif : faire bénéficier les articles DÉJÀ publiés des nouveaux blocs de la
 * refonte templates (réponses 40-60 mots/H2, avis d'expert interne, point clé,
 * callouts, images de corps, liens profonds…) SANS créer de doublon d'URL.
 *
 * Mécanisme : on relit les paramètres du job d'origine (`Article.generatedByJobId`
 * → ContentGenJob.inputPayload + contentType + anchors + intent + template), on
 * recrée un ContentGenJob identique en y injectant le marqueur `refreshArticleId`,
 * et on l'enqueue. Le `content-publish-worker` détecte ce marqueur et MET À JOUR
 * l'article existant (slug FR PRÉSERVÉ = URL stable, zéro 301) au lieu de créer
 * un nouvel enregistrement.
 *
 * Garde-fous : seuls les articles publiés issus d'un type à générateur direct
 * sont régénérables ; un refresh déjà en vol pour le même article est un no-op ;
 * la publication reste soumise au drip-window + daily-cap du worker (throttle
 * naturel anti-régénération de masse incontrôlée).
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { Queue } from "bullmq";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
// Fix 2026-08-15 (audit e2e) — options par défaut partagées des files content-gen.
import { CONTENT_GEN_JOB_OPTIONS } from "@/server/content-gen/queue/job-options";
import { requireAdmin } from "./_auth";
import {
  buildRegenerationJobData,
  deriveSourceJobFromArticle,
  NON_TERMINAL_STATUSES,
  REGENERABLE_CONTENT_TYPES,
  type RegenSourceJob,
} from "./regenerate-helpers";

let contentGenQueue: Queue | null = null;
function getContentGenQueue(): Queue | null {
  if (contentGenQueue) return contentGenQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  // Fix 2026-08-15 (audit e2e) — `defaultJobOptions` partagées : sans elles
  // la file héritait du défaut BullMQ (1 tentative, pas de backoff).
  contentGenQueue = new Queue("content-gen", {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return contentGenQueue;
}

export interface RegenerateArticleResult {
  readonly ok: boolean;
  readonly articleId: string;
  readonly jobId?: string;
  readonly enqueuedInBullmq?: boolean;
  /** Raison de no-op / refus (article introuvable, type non régénérable, refresh déjà en vol…). */
  readonly skippedReason?: string;
}

/** Cœur interne (sans auth) — utilisé par l'action unitaire ET le batch. */
async function enqueueRegeneration(
  articleId: string,
  createdBy: string,
): Promise<RegenerateArticleResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      status: true,
      generatedByJobId: true,
      searchIntent: true,
      translations: { where: { locale: "fr" }, select: { slug: true, title: true } },
    },
  });
  if (!article) {
    return { ok: false, articleId, skippedReason: "article_not_found" };
  }
  if (article.status !== "published") {
    return { ok: false, articleId, skippedReason: `not_published:${article.status}` };
  }

  // Job source d'origine si encore présent → params EXACTS. Sinon → Option B
  // (2026-06-25) : on dérive un job source depuis l'article. Les content_gen_jobs
  // sont purgés après complétion ; sans ce fallback, un article ancien renvoie
  // « source_job_not_found » et n'est JAMAIS régénérable (constaté : 0/18 en local).
  let sourceJob: RegenSourceJob | null = null;
  if (article.generatedByJobId) {
    const found = await prisma.contentGenJob.findUnique({
      where: { id: article.generatedByJobId },
      select: {
        contentType: true,
        targetSearchIntent: true,
        targetLocale: true,
        anchorVilleSlug: true,
        anchorRegionSlug: true,
        anchorDepartementCode: true,
        templateId: true,
        serviceSector: true,
        campaignId: true,
        primaryProvider: true,
        fallbackProvider: true,
        inputPayload: true,
      },
    });
    if (found && REGENERABLE_CONTENT_TYPES.has(found.contentType)) {
      sourceJob = found as RegenSourceJob;
    }
  }
  if (!sourceJob) {
    sourceJob = deriveSourceJobFromArticle({
      searchIntent: article.searchIntent,
      title: article.translations[0]?.title ?? null,
    });
  }

  // Anti-doublon en vol : un refresh non terminal cible déjà cet article ?
  const inFlight = await prisma.contentGenJob.findFirst({
    where: {
      inputPayload: { path: ["refreshArticleId"], equals: articleId },
      status: { in: [...NON_TERMINAL_STATUSES] as never },
    },
    select: { id: true },
  });
  if (inFlight) {
    return { ok: true, articleId, jobId: inFlight.id, skippedReason: "refresh_in_flight" };
  }

  const { idempotencyKey, inputPayload, data } = buildRegenerationJobData({
    articleId,
    preservedSlug: article.translations[0]?.slug ?? null,
    sourceJob: sourceJob as RegenSourceJob,
    createdBy,
    slotMs: Date.now(),
  });

  // Slot 60s déjà utilisé ? (double-clic) → no-op.
  const existing = await prisma.contentGenJob.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, articleId, jobId: existing.id, enqueuedInBullmq: false };
  }

  const dbJob = await prisma.contentGenJob.create({
    data: data as never,
    select: { id: true },
  });

  const queue = getContentGenQueue();
  let enqueuedInBullmq = false;
  if (queue) {
    await queue.add(
      "generate",
      {
        contentGenJobId: dbJob.id,
        contentType: sourceJob.contentType,
        targetSearchIntent: sourceJob.targetSearchIntent,
        inputPayload,
        ...(sourceJob.templateId ? { templateId: sourceJob.templateId } : {}),
      },
      { jobId: `gen-${dbJob.id}` },
    );
    enqueuedInBullmq = true;
  }

  return { ok: true, articleId, jobId: dbJob.id, enqueuedInBullmq };
}

/**
 * Régénère UN article publié en place (même URL). Server action admin.
 */
export async function regenerateArticle(articleId: string): Promise<RegenerateArticleResult> {
  try {
    const session = await requireAdmin();
    const result = await enqueueRegeneration(articleId, session.userId);
    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/jobs`);
    return result;
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "regenerateArticle" } });
    throw e;
  }
}

export interface RegenerateBatchResult {
  readonly requested: number;
  readonly enqueued: number;
  readonly skipped: number;
  readonly results: readonly RegenerateArticleResult[];
}

/**
 * Régénère par lot les articles tier-1 les plus ANCIENS (par publishedAt asc),
 * issus d'un générateur direct. Cap de sécurité strict (≤ 25) pour éviter une
 * tempête de génération ; la publication reste throttlée par le drip-window +
 * daily-cap du worker. À appeler en plusieurs passes pour couvrir tout le corpus.
 */
export async function regenerateTier1Corpus(opts?: {
  limit?: number;
}): Promise<RegenerateBatchResult> {
  try {
    const session = await requireAdmin();
    const limit = Math.max(1, Math.min(25, opts?.limit ?? 10));

    const candidates = await prisma.article.findMany({
      where: {
        status: "published",
        indexationTier: "tier_1_indexable",
        generatedByJobId: { not: null },
      },
      orderBy: { publishedAt: "asc" },
      take: limit,
      select: { id: true },
    });

    const results: RegenerateArticleResult[] = [];
    for (const c of candidates) {
      // Séquentiel volontaire : chaque enqueue est léger, et on évite de saturer
      // la queue d'un coup. Le throttle réel est côté worker (drip + cap).
      results.push(await enqueueRegeneration(c.id, session.userId));
    }

    revalidatePath(`/fr/${process.env.ADMIN_URL_PREFIX ?? "admin"}/content-gen/jobs`);

    const enqueued = results.filter((r) => r.ok && r.jobId && !r.skippedReason).length;
    return {
      requested: candidates.length,
      enqueued,
      skipped: results.length - enqueued,
      results,
    };
  } catch (e) {
    Sentry.captureException(e, { tags: { area: "content-gen", action: "regenerateTier1Corpus" } });
    throw e;
  }
}
