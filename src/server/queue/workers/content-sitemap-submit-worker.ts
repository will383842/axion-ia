/**
 * Worker de soumission du sitemap des articles (Search Console `sitemaps.submit`).
 * Éteint par défaut (`GSC_SITEMAP_SUBMIT_ENABLED`). Voir `indexing/sitemap-submit.ts`.
 */

import { Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { gscSoumettreSitemap } from "@/server/content-gen/seo/gsc-client";
import {
  SITEMAP_SUBMIT_DERNIERE_CLE,
  SITEMAP_SUBMIT_QUEUE,
  soumissionSitemapActive,
} from "@/server/content-gen/indexing/sitemap-submit";

export async function traiterSoumissionSitemap(job: Pick<Job<{ sitemap: string }>, "data">) {
  if (!soumissionSitemapActive()) return;
  const { etat } = await gscSoumettreSitemap(job.data.sitemap);
  if (etat === "ok") {
    await redis.set(SITEMAP_SUBMIT_DERNIERE_CLE, String(Date.now()));
    console.log(`[sitemap-submit] sitemap soumis : ${job.data.sitemap}`);
  } else if (etat === "portee_insuffisante") {
    console.warn(
      "[sitemap-submit] ESCALADE portée Search Console : le jeton OAuth n'a pas la portée " +
        "https://www.googleapis.com/auth/webmasters (écriture). Régénérer GSC_OAUTH_REFRESH_TOKEN.",
    );
  } else {
    console.warn(`[sitemap-submit] soumission non faite (${etat})`);
  }
}

let workerInstance: Worker<{ sitemap: string }> | null = null;

export function startSitemapSubmitWorker(): Worker<{ sitemap: string }> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — sitemap-submit-worker cannot start");
  workerInstance = new Worker(SITEMAP_SUBMIT_QUEUE, traiterSoumissionSitemap, {
    connection: { url: redisUrl },
    concurrency: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });
  workerInstance.on("failed", (job, err) => {
    captureWorkerError("sitemap-submit", SITEMAP_SUBMIT_QUEUE, job, err);
  });
  return workerInstance;
}

export async function stopSitemapSubmitWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
