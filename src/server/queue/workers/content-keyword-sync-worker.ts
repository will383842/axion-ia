/**
 * Content Generator — Keyword sync worker (Sprint 12.5 V2).
 *
 * Cron hebdo lundi 04:00 UTC (`bootRepeatableJobs` queues.ts).
 *
 * Pipeline :
 *  1. Pick Articles tier-1 + tier-2 publiés ≥ 7j
 *  2. Pour chaque : query GSC API → top 10 keywords par article
 *     (fallback SerpAPI si GSC skeleton)
 *  3. UPSERT KeywordTracking (unique [keyword, targetUrl]) avec
 *     positionDelta vs précédent sync
 *  4. Log stats : nouveaux keywords, gaps détectés, cannibalization
 *
 * SKELETON V1 : sans credentials GSC ou SerpAPI, le worker tourne mais
 * retourne 0 row inséré. Activation full = Sprint 10.5 (GSC) ou
 * Sprint 12.6 (SerpAPI key).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { buildArticleUrl } from "@/server/content-gen/indexing/url-builder";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { gscTopKeywordsForUrl } from "@/server/content-gen/seo/gsc-client";

const QUEUE_NAME = "content-keyword-sync";
const RECENT_DAYS_MIN = 7;

interface SyncStats {
  articlesScanned: number;
  keywordsUpserted: number;
  apiSkipped: number;
}

/**
 * Pull top keywords GSC pour une URL via OAuth refresh_token flow.
 *
 * V1 activée 2026-05-15 — wire vers `gsc-client` qui gère :
 *   - OAuth refresh access_token (cache 55min)
 *   - searchAnalytics.query avec filter `page=targetUrl`
 *   - Skip silencieux si credentials absents (graceful degrade dev/preview)
 *
 * Retourne null si credentials absents ou erreur API (worker continue avec
 * apiSkipped++). Retourne array vide si la page n'a aucun keyword GSC dans la
 * fenêtre (page trop neuve ou pas de trafic).
 */
async function fetchTopKeywordsForUrl(
  url: string,
  daysWindow: number,
): Promise<ReadonlyArray<{
  keyword: string;
  position: number;
  ctr: number;
  impressions: number;
  clicks: number;
}> | null> {
  return gscTopKeywordsForUrl(url, daysWindow, 10);
}

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  // Audit 2026-05-15 P1-8 — kill-switch check (GSC/SerpAPI quota+coût, évite
  // de gaspiller pendant pause Will).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log("[keyword-sync] kill switch active, skip run");
    return;
  }

  const stats: SyncStats = { articlesScanned: 0, keywordsUpserted: 0, apiSkipped: 0 };
  const recentThreshold = new Date(Date.now() - RECENT_DAYS_MIN * 86_400_000);

  const articles = await prisma.article.findMany({
    where: {
      status: "published",
      publishedAt: { lte: recentThreshold },
      indexationTier: { in: ["tier_1_indexable", "tier_2_noindex_follow"] },
    },
    include: { translations: { where: { locale: "fr" } } },
    take: 500,
    orderBy: { publishedAt: "desc" },
  });

  stats.articlesScanned = articles.length;

  for (const article of articles) {
    const t = article.translations[0];
    if (!t) continue;
    const url = buildArticleUrl({ slug: t.slug, isNews: article.isNews });
    const keywords = await fetchTopKeywordsForUrl(url, 28);

    if (keywords === null) {
      stats.apiSkipped++;
      continue;
    }

    for (const k of keywords) {
      const existing = await prisma.keywordTracking.findUnique({
        where: { keyword_targetUrl: { keyword: k.keyword, targetUrl: url } },
      });

      const positionDelta = existing ? k.position - Number(existing.position) : null;

      await prisma.keywordTracking.upsert({
        where: { keyword_targetUrl: { keyword: k.keyword, targetUrl: url } },
        create: {
          keyword: k.keyword,
          targetUrl: url,
          articleId: article.id,
          position: k.position,
          ctr: k.ctr,
          impressions: k.impressions,
          clicks: k.clicks,
          source: "gsc",
        },
        update: {
          position: k.position,
          positionDelta,
          ctr: k.ctr,
          impressions: k.impressions,
          clicks: k.clicks,
          syncedAt: new Date(),
        },
      });
      stats.keywordsUpserted++;
    }
  }

  console.log(
    `[keyword-sync] run done — articles=${stats.articlesScanned} kw_upserted=${stats.keywordsUpserted} api_skipped=${stats.apiSkipped}`,
  );
}

let workerInstance: Worker | null = null;

export function startKeywordSyncWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — keyword-sync-worker cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-keyword-sync-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopKeywordSyncWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
