/**
 * Keyword Opportunity Detector — Phase 8 Sprint Perfection 2026-05-22
 *
 * Cron weekly lundi 06:00 UTC.
 *
 * Pour chaque keyword tracké :
 *  1. Position > 10 + opportunity='high' + pas d'article → suggestion campaign
 *  2. Position drop > 5 places en 7j → alerte Telegram
 *  3. Concurrent passe devant nous → alerte Telegram
 *
 * Skeleton V1 — actif mais silencieux si table keyword_tracking vide.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";

const QUEUE_NAME = "keyword-opportunity-detector";

interface OpportunityStats {
  keywordsScanned: number;
  opportunitiesHigh: number;
  rankDropAlerts: number;
  competitorAlerts: number;
  campaignSuggestionsCreated: number;
}

async function detectOpportunities(): Promise<OpportunityStats> {
  const stats: OpportunityStats = {
    keywordsScanned: 0,
    opportunitiesHigh: 0,
    rankDropAlerts: 0,
    competitorAlerts: 0,
    campaignSuggestionsCreated: 0,
  };

  // Early exit si DB stub (build GH Actions)
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return stats;

  const trackings = await prisma.keywordTracking.findMany({
    where: {
      // Seuls les keywords synchés dans les 14 derniers jours
      syncedAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { position: "asc" },
    take: 1000,
  });

  stats.keywordsScanned = trackings.length;

  for (const tracking of trackings) {
    const pos = Number(tracking.position);
    const delta = tracking.positionDelta ? Number(tracking.positionDelta) : 0;

    // Détection opportunité haute : position > 10 et pas encore rankée top 10
    if (pos > 10 && tracking.axionOpportunity === "high") {
      stats.opportunitiesHigh++;
      // Marquage pour suggestion campaign (sans créer une vraie campaign ici)
      await prisma.keywordTracking.update({
        where: { id: tracking.id },
        data: { recommendedAction: recommendAction(tracking.keyword, pos) },
      });
    }

    // Détection rank drop > 5 places
    if (delta > 5) {
      stats.rankDropAlerts++;
      // Log structuré (Telegram câblé dans content-monitoring-worker)
      console.warn(
        JSON.stringify({
          event: "keyword_rank_drop",
          keyword: tracking.keyword,
          position: pos,
          delta,
          targetUrl: tracking.targetUrl,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    // Mise à jour ourCurrentRank
    await prisma.keywordTracking.update({
      where: { id: tracking.id },
      data: {
        ourCurrentRank: Math.round(pos),
        ourBestRank:
          tracking.ourBestRank === null || pos < tracking.ourBestRank
            ? Math.round(pos)
            : tracking.ourBestRank,
        ourFirstRankAt:
          tracking.ourFirstRankAt === null && pos <= 10 ? new Date() : tracking.ourFirstRankAt,
        trendDirection: delta > 2 ? "down" : delta < -2 ? "up" : "stable",
      },
    });
  }

  return stats;
}

function recommendAction(keyword: string, position: number): string {
  if (position <= 20) return `Améliorer article existant + FAQ schema (position ${position})`;
  if (position <= 50) return `Créer article pilier 3000+ mots sur "${keyword}"`;
  return `Créer contenu initial + LocalBusiness JSON-LD pour "${keyword}"`;
}

// ── Worker BullMQ ─────────────────────────────────────────────────────────────

export function createKeywordOpportunityDetectorWorker(redisUrl: string) {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const startAt = Date.now();
      try {
        const stats = await detectOpportunities();
        console.log(
          JSON.stringify({
            event: "keyword_opportunity_detector_done",
            jobId: job.id,
            durationMs: Date.now() - startAt,
            ...stats,
          }),
        );
        return stats;
      } catch (err) {
        captureWorkerError("keyword-opportunity-detector", QUEUE_NAME, job, err);
        throw err;
      }
    },
    {
      connection: { url: redisUrl },
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    captureWorkerError("keyword-opportunity-detector", QUEUE_NAME, job, err);
  });

  return worker;
}

export const KEYWORD_OPPORTUNITY_CRON = {
  name: "keyword-opportunity-detector-weekly",
  every: undefined,
  pattern: "0 6 * * 1", // Lundi 06:00 UTC
  queueName: QUEUE_NAME,
};
