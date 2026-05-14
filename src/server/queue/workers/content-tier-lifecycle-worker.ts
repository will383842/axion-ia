/**
 * Content Generator — Tier lifecycle worker (Sprint 10 V2).
 *
 * Cron mensuel 15 du mois 06:00 UTC (`bootRepeatableJobs` queues.ts).
 *
 * Pipeline :
 *  1. Pick Articles tier-2 publiés ≥ 30j (promote candidates)
 *  2. Pick Articles tier-1 publiés ≥ 60j (demote candidates)
 *  3. Pour chaque : fetch CTR via GSC (skeleton V1 = null) → compute decision
 *  4. Apply : promote / demote / noop selon décision
 *  5. Log dans console + GenerationLog (audit trail)
 *
 * V1 SKELETON : sans credentials GSC, le worker tourne mais retourne 0
 * action (tous noop "no_data"). Activation full = Sprint 10.5.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  computeTierDecision,
  DEFAULT_TIER_THRESHOLDS,
  type IndexationTier,
} from "@/server/content-gen/lifecycle/tier-decisions";
import { fetchSearchConsoleCtr } from "@/server/content-gen/lifecycle/analytics-clients";
import { enqueueIndexingForTier1 } from "@/server/content-gen/indexing/enqueue";
import { buildArticleUrl } from "@/server/content-gen/indexing/url-builder";

const QUEUE_NAME = "content-tier-lifecycle";
const PROMOTE_AGE_DAYS = DEFAULT_TIER_THRESHOLDS.promoteAgeDaysMin;
const DEMOTE_AGE_DAYS = DEFAULT_TIER_THRESHOLDS.demoteAgeDaysMin;
const PROMOTE_WINDOW_DAYS = 30;
const DEMOTE_WINDOW_DAYS = 60;
const MAX_BATCH_PER_RUN = 200;

interface RunStats {
  scanned: number;
  promoted: number;
  demoted: number;
  noop: number;
  noData: number;
}

async function applyPromote(
  articleId: string,
  slug: string,
  isNews: boolean,
  reason: string,
): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      indexationTier: "tier_1_indexable" as IndexationTier,
      promotedAt: new Date(),
    },
  });
  await enqueueIndexingForTier1({ articleId, slug, isNews, origin: "tier-promote" });
  console.log(`[tier-lifecycle] PROMOTE article=${articleId} reason=${reason}`);
}

async function applyDemote(articleId: string, reason: string): Promise<void> {
  await prisma.article.update({
    where: { id: articleId },
    data: {
      indexationTier: "tier_2_noindex_follow" as IndexationTier,
      promotedAt: null,
    },
  });
  console.log(`[tier-lifecycle] DEMOTE article=${articleId} reason=${reason}`);
}

async function processArticles(
  tier: IndexationTier,
  publishedBefore: Date,
  windowDays: number,
  stats: RunStats,
): Promise<void> {
  const candidates = await prisma.article.findMany({
    where: {
      status: "published",
      indexationTier: tier,
      publishedAt: { lte: publishedBefore },
    },
    include: { translations: { where: { locale: "fr" } } },
    take: MAX_BATCH_PER_RUN,
    orderBy: { publishedAt: "asc" },
  });

  stats.scanned += candidates.length;

  for (const article of candidates) {
    const t = article.translations[0];
    if (!t) continue;
    const url = buildArticleUrl({ slug: t.slug, isNews: article.isNews });
    const metrics = await fetchSearchConsoleCtr(url, windowDays);
    const ageDays = article.publishedAt
      ? Math.floor((Date.now() - article.publishedAt.getTime()) / 86_400_000)
      : 0;

    const decision = computeTierDecision({
      currentTier: article.indexationTier as IndexationTier,
      ageDays,
      ctr: metrics?.ctr ?? null,
      impressions: metrics?.impressions ?? null,
      wasManuallyPromoted: article.promotedAt !== null,
    });

    if (decision.action === "promote" && decision.nextTier === "tier_1_indexable") {
      await applyPromote(article.id, t.slug, article.isNews, decision.reason);
      stats.promoted++;
    } else if (decision.action === "demote") {
      await applyDemote(article.id, decision.reason);
      stats.demoted++;
    } else if (decision.reason === "no_data") {
      stats.noData++;
    } else {
      stats.noop++;
    }
  }
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  const stats: RunStats = { scanned: 0, promoted: 0, demoted: 0, noop: 0, noData: 0 };
  const now = Date.now();
  const promoteThreshold = new Date(now - PROMOTE_AGE_DAYS * 86_400_000);
  const demoteThreshold = new Date(now - DEMOTE_AGE_DAYS * 86_400_000);

  await processArticles("tier_2_noindex_follow", promoteThreshold, PROMOTE_WINDOW_DAYS, stats);
  await processArticles("tier_1_indexable", demoteThreshold, DEMOTE_WINDOW_DAYS, stats);

  console.log(
    `[tier-lifecycle] run done — scanned=${stats.scanned} promoted=${stats.promoted} ` +
      `demoted=${stats.demoted} noop=${stats.noop} no_data=${stats.noData}`,
  );
}

let workerInstance: Worker | null = null;

export function startTierLifecycleWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — tier-lifecycle-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-tier-lifecycle-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopTierLifecycleWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
