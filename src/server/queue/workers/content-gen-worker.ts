/**
 * Content Generator — BullMQ worker (Sprint 2 AGT-H).
 *
 * V1 = squelette. Pipeline (§ 13.1 master prompt + § 25.3) :
 *
 * 1. Job arrive sur queue `content-gen`
 * 2. Lookup ContentGenJob DB → status running
 * 3. Hard gate KB ready (kb-health.assertKbReady)
 * 4. Pre-IA dedup-guard check (4 couches v1.7)
 * 5. Resolve generator via getGenerator(contentType)
 * 6. Call generator.generate(input) → GeneratorOutput
 * 7. Post-process : Q/R extraction (enqueue 8 micro-jobs qa_extract_and_publish)
 * 8. Insert Article DB tier_2_noindex_follow par défaut (review-queue)
 * 9. Update ContentGenJob status → needs_review
 * 10. Publish Telegram alert (§ 12.3bis)
 *
 * Concurrency 5 par defaut (config DB ContentGenConfig.workers_concurrency).
 * Rate-limit 10/min (alignée OpenAI tier 5).
 */

import { Worker, type Job, UnrecoverableError } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getGenerator } from "@/server/content-gen/generators";
import { assertKbReady, KbNotReadyError } from "@/server/content-gen/kb-health";
import { checkDedup } from "@/server/content-gen/quality/dedup-guard";
import { checkPlagiarism } from "@/server/content-gen/quality/plagiarism";
import { validateIntentAlignment } from "@/server/content-gen/quality/search-intent-validator";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { logStep, logStepError } from "@/server/content-gen/shared/generation-log";
import type { ContentType, SearchIntent } from "../../../../prisma/generated/client";

interface KillSwitchState {
  readonly active: boolean;
}

interface PoliciesConfig {
  readonly plagiarismJaccardInternal?: number;
  readonly plagiarismJaccardRss?: number;
}

const PLAGIARISM_CORPUS_SIZE = 50;
const PLAGIARISM_THRESHOLD_DEFAULT = 0.3;
const PLAGIARISM_THRESHOLD_RSS_DEFAULT = 0.1;

/**
 * Charge le corpus des derniers articles publiés (tier-1 + tier-2) pour
 * comparaison plagiarism shingling Jaccard. Limite hardcodée à 50 articles
 * pour cap latence (5-gram shingles × 50 articles ≈ 50ms en local).
 *
 * Doctrine § 10.1 master prompt — anti-plagiat 3 couches.
 */
async function loadPlagiarismCorpus(): Promise<Map<string, string>> {
  const rows = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: { in: ["tier_1_indexable", "tier_2_noindex_follow"] },
    },
    orderBy: { publishedAt: "desc" },
    take: PLAGIARISM_CORPUS_SIZE,
    include: {
      translations: {
        where: { locale: "fr" },
        select: { slug: true, bodyText: true, body: true },
        take: 1,
      },
    },
  });
  const corpus = new Map<string, string>();
  for (const row of rows) {
    const tr = row.translations[0];
    if (!tr) continue;
    const text =
      tr.bodyText ??
      tr.body
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length > 100) corpus.set(tr.slug, text);
  }
  return corpus;
}

class KillSwitchActiveError extends Error {
  constructor() {
    super("Kill switch content-gen actif — job requeue");
    this.name = "KillSwitchActiveError";
  }
}

const QUEUE_NAME = "content-gen";

export interface ContentGenJobPayload {
  readonly contentGenJobId: string;
  readonly contentType: ContentType;
  readonly targetSearchIntent: SearchIntent;
  readonly inputPayload: Record<string, unknown>;
}

async function processJob(job: Job<ContentGenJobPayload>): Promise<void> {
  const { contentGenJobId, contentType, targetSearchIntent, inputPayload } = job.data;

  // 0. Kill switch hard-gate (§ 12 master prompt) — checked AVANT lookup DB
  // pour économiser les queries quand le switch est ON. Le worker BullMQ
  // requeue le job avec backoff exponentiel quand on throw — pas de fail.
  const killSwitch = await readContentGenConfig<KillSwitchState>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    await logStep(contentGenJobId, "kill_switch_check", "Kill switch active — job requeued");
    throw new KillSwitchActiveError();
  }

  // 1. Lookup ContentGenJob DB
  const dbJob = await prisma.contentGenJob.findUnique({ where: { id: contentGenJobId } });
  if (!dbJob) {
    // Pas de retry sur job introuvable — UnrecoverableError marque le job fail
    // sans backoff inutile.
    throw new UnrecoverableError(`ContentGenJob ${contentGenJobId} not found`);
  }
  await logStep(contentGenJobId, "kb_retrieve", "Job found, starting pipeline", {
    contentType,
    targetSearchIntent,
  });

  // 2. Hard gate KB ready
  try {
    await assertKbReady();
  } catch (err) {
    if (err instanceof KbNotReadyError) {
      await logStepError(contentGenJobId, "kb_retrieve", err.message);
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: { status: "failed", errorMessage: err.message },
      });
      return;
    }
    throw err;
  }

  // 3. Status → running + dedup pre-IA
  await prisma.contentGenJob.update({
    where: { id: contentGenJobId },
    data: { status: "running", startedAt: new Date() },
  });

  const title = typeof inputPayload["title"] === "string" ? inputPayload["title"] : "";
  if (title) {
    const dedup = await checkDedup({
      title,
      ...(typeof inputPayload["primaryKeyword"] === "string"
        ? { primaryKeyword: inputPayload["primaryKeyword"] }
        : {}),
      ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
      ...(dbJob.targetAudienceSize ? { targetAudienceSize: dbJob.targetAudienceSize } : {}),
      ...(dbJob.targetAudienceOrganisation
        ? { targetAudienceOrganisation: dbJob.targetAudienceOrganisation }
        : {}),
    });
    if (!dedup.passed) {
      await logStep(contentGenJobId, "dedup_check", `Dedup blocked: ${dedup.reason ?? "unknown"}`, {
        reason: dedup.reason,
      });
      await prisma.contentGenJob.update({
        where: { id: contentGenJobId },
        data: {
          status: "cancelled",
          errorMessage: `Dedup pre-IA: ${dedup.reason ?? "unknown"}`,
        },
      });
      return;
    }
    await logStep(contentGenJobId, "dedup_check", "Dedup passed");
  }

  // 4. Resolve generator + generate
  const generator = getGenerator(contentType);
  try {
    const startedAt = Date.now();
    const output = await generator.generate({
      jobId: contentGenJobId,
      contentType,
      targetSearchIntent,
      ...(dbJob.anchorVilleSlug ? { anchorVilleSlug: dbJob.anchorVilleSlug } : {}),
      ...(dbJob.anchorDepartementCode
        ? { anchorDepartementCode: dbJob.anchorDepartementCode }
        : {}),
      ...(dbJob.anchorRegionSlug ? { anchorRegionSlug: dbJob.anchorRegionSlug } : {}),
      ...(dbJob.targetAudienceSize ? { targetAudienceSize: dbJob.targetAudienceSize } : {}),
      ...(dbJob.targetAudienceOrganisation
        ? { targetAudienceOrganisation: dbJob.targetAudienceOrganisation }
        : {}),
      ...(typeof inputPayload["primaryKeyword"] === "string"
        ? { primaryKeyword: inputPayload["primaryKeyword"] }
        : {}),
    });

    await logStep(contentGenJobId, "llm_call", "Generator output ready", {
      duration_ms: Date.now() - startedAt,
      quality_score: output.qualityScore,
      seo_score: output.seoScore,
      readability_score: output.readabilityScore,
      total_tokens: output.totalTokens,
      total_cost_usd: output.totalCostUsd,
    });

    // 4bis. Anti-plagiarism shingling Jaccard (§ 10.1 master prompt v1.7).
    // Comparaison vs top 50 articles publiés récents. Seuils DB-managed via
    // ContentGenConfig.policies (plagiat 0.30 interne / 0.10 RSS).
    const policies = await readContentGenConfig<PoliciesConfig>("policies", {});
    const plagiarismThreshold =
      contentType === "blog_from_rss"
        ? (policies.plagiarismJaccardRss ?? PLAGIARISM_THRESHOLD_RSS_DEFAULT)
        : (policies.plagiarismJaccardInternal ?? PLAGIARISM_THRESHOLD_DEFAULT);
    const corpus = await loadPlagiarismCorpus();
    const plagiarism = checkPlagiarism(output.bodyText, corpus, plagiarismThreshold);
    await logStep(
      contentGenJobId,
      "plagiarism_check",
      plagiarism.passed
        ? `Plagiarism OK (max=${plagiarism.maxSimilarity.toFixed(3)} < ${plagiarismThreshold})`
        : `Plagiarism BLOCKED (max=${plagiarism.maxSimilarity.toFixed(3)} ≥ ${plagiarismThreshold})`,
      {
        max_similarity: plagiarism.maxSimilarity,
        threshold: plagiarismThreshold,
        passed: plagiarism.passed,
        top_matches: plagiarism.topMatches.map((m) => ({
          corpus_id: m.corpusId,
          similarity: m.similarity,
        })),
        corpus_size: corpus.size,
      },
    );

    // 4ter. Intent alignment validator (§ 26.3 master prompt v1.7).
    // hardFails downgrade tier → tier_3_noindex_nofollow. Warnings = info only.
    const intent = validateIntentAlignment({
      intent: targetSearchIntent,
      slug: output.slug,
      title: output.title,
      metaDescription: output.metaDescription,
      bodyHtml: output.bodyHtml,
      hasLocalBusinessJsonLd: targetSearchIntent === "local" && Boolean(dbJob.anchorVilleSlug),
      hasGeoMeta: Boolean(dbJob.anchorVilleSlug || dbJob.anchorRegionSlug),
      hasComparisonTable: /<table[\s>]/i.test(output.bodyHtml),
      hasPrimaryCta: /(href=["'][^"']*reserver|<button|cta-primary)/i.test(output.bodyHtml),
      citationCount: output.citations.length,
    });
    await logStep(
      contentGenJobId,
      "intent_check",
      intent.aligned
        ? `Intent aligned (${intent.warnings.length} warnings)`
        : `Intent MISALIGNED (${intent.hardFails.length} hardFails)`,
      {
        aligned: intent.aligned,
        intent: targetSearchIntent,
        warnings: intent.warnings,
        hard_fails: intent.hardFails,
      },
    );

    // Tier final : downgrade tier_3 si plagiat OR intent hardFails.
    // Sinon on garde l'indexationTier issu du generator (tier_2 default).
    const blockingFail = !plagiarism.passed || !intent.aligned;
    const finalIndexationTier = blockingFail ? "tier_3_noindex_nofollow" : output.indexationTier;

    // 5. Update job + persist outputs (Sprint 2 Day 5 — Article DB row insert).
    // `outputJsonRaw` est la source de vérité que `content-publish-worker.ts`
    // lit pour créer la row Article. Sans ça, la publication throwait
    // « ContentGenJob has no outputJsonRaw » en prod.
    const persistedOutput = {
      ...output,
      finalIndexationTier,
      intentAligned: intent.aligned,
      intentWarnings: intent.warnings,
      intentHardFails: intent.hardFails,
      plagiarismMaxSimilarity: plagiarism.maxSimilarity,
      plagiarismThreshold,
      plagiarismCorpusSize: corpus.size,
    };
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: {
        status: "needs_review",
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        qualityScore: output.qualityScore,
        seoScore: output.seoScore,
        readabilityScore: output.readabilityScore,
        plagiarismScore: plagiarism.maxSimilarity,
        doctrineCheckPassed: !blockingFail,
        tokensInput: 0, // détaillé via CostLedger
        tokensOutput: output.totalTokens,
        costUsd: output.totalCostUsd,
        outputJsonRaw: persistedOutput as never,
      },
    });
    await logStep(contentGenJobId, "validation", "Job persisted to needs_review", {
      blocking_fail: blockingFail,
      final_tier: finalIndexationTier,
    });

    // 6. Insert ReviewQueue row (status=pending) pour validation humaine admin.
    // Sans cette row, /review-queue/[id] ne trouve rien et le flow approve/promote
    // n'a pas de cible. Idempotent via unique jobId.
    try {
      await prisma.reviewQueue.create({
        data: {
          jobId: contentGenJobId,
          status: "pending",
        },
      });
    } catch (err) {
      // P2002 unique conflict = déjà créé (retry idempotent), no-op
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[content-gen-worker] reviewQueue create skipped (likely retry):`, err);
      }
    }

    // 6. TODO Sprint 2 Day 6 — hook qa_extract_and_publish (8 micro-jobs)
    // 7. TODO Sprint 2 Day 7 — Telegram alert "Nouveau contenu en review"
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logStepError(contentGenJobId, "error", errMsg, {
      error_name: err instanceof Error ? err.name : "Unknown",
    });
    await prisma.contentGenJob.update({
      where: { id: contentGenJobId },
      data: {
        status: "failed",
        errorMessage: errMsg,
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

let workerInstance: Worker<ContentGenJobPayload> | null = null;

/**
 * Démarre le worker BullMQ (V1 concurrency 5 hardcoded — V2 DB-managed).
 * À appeler depuis `src/server/queue/index.ts` au démarrage de l'app.
 */
export function startContentGenWorker(): Worker<ContentGenJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL not set — content-gen-worker cannot start");
  }
  workerInstance = new Worker<ContentGenJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 5,
    limiter: { max: 10, duration: 60_000 }, // 10/min — alignée OpenAI tier 5
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-gen-worker] job ${job?.id} failed:`, err);
  });
  workerInstance.on("completed", (job) => {
    console.log(`[content-gen-worker] job ${job.id} completed`);
  });
  return workerInstance;
}

export async function stopContentGenWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
