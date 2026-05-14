/**
 * Content Generator — News lifecycle worker (§ 28.1 cycle de vie RSS v1.7).
 *
 * Cron quotidien 05:00 UTC. Pour les contenus type `blog_from_rss` :
 *
 *  - Si publié il y a > 14 jours ET viewCount < seuil → demote tier-2 noindex
 *  - Si publié il y a > 90 jours (peu importe CTR) → archive (status='archived'
 *    sur Article, ContentGenJob conserve l'audit trail)
 *
 * Seuils configurables via ContentGenConfig.key="news_lifecycle".
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";

const QUEUE_NAME = "content-news-lifecycle";

interface NewsLifecycleSettings {
  readonly demoteAfterDays: number;
  readonly minViewsToKeepTier1: number;
  readonly archiveAfterDays: number;
}

const DEFAULTS: NewsLifecycleSettings = {
  demoteAfterDays: 14,
  minViewsToKeepTier1: 50,
  archiveAfterDays: 90,
};

async function processJob(_job: Job<{ readonly trigger: string }>): Promise<void> {
  const settings = await readContentGenConfig<NewsLifecycleSettings>("news_lifecycle", DEFAULTS);

  const now = Date.now();
  const demoteThreshold = new Date(now - settings.demoteAfterDays * 24 * 60 * 60 * 1000);
  const archiveThreshold = new Date(now - settings.archiveAfterDays * 24 * 60 * 60 * 1000);

  // 1. Archive vieux RSS (> 90j)
  const toArchive = await prisma.contentGenJob.findMany({
    where: {
      contentType: "blog_from_rss",
      status: "published",
      completedAt: { lt: archiveThreshold },
    },
    select: { id: true, outputBlogPostId: true },
    take: 200,
  });

  for (const j of toArchive) {
    if (j.outputBlogPostId) {
      await prisma.article
        .update({
          where: { id: j.outputBlogPostId },
          data: { status: "archived" },
        })
        .catch(() => {
          // article may have been deleted manually — ignore
        });
    }
  }

  // 2. Demote sous-perfomants (> 14j et < minViews)
  // V1 : on n'a pas encore le tracking viewCount par Article pour content-gen.
  // Cette étape est un placeholder Sprint 5+ (besoin Plausible API sync).
  // Pour V1 on log uniquement combien d'articles seraient candidats.
  const candidates = await prisma.contentGenJob.count({
    where: {
      contentType: "blog_from_rss",
      status: "published",
      completedAt: { lt: demoteThreshold, gte: archiveThreshold },
    },
  });

  console.log(
    `[news-lifecycle] archived ${toArchive.length} (>${settings.archiveAfterDays}j), ${candidates} candidates demote tier-2 (Plausible sync Sprint 5+).`,
  );
}

let workerInstance: Worker | null = null;

export function startNewsLifecycleWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — news-lifecycle cannot start");
  workerInstance = new Worker(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[news-lifecycle] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopNewsLifecycleWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
