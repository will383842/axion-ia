/**
 * Content Generator — Google Indexing API worker (§ 9bis.1 v1.7).
 *
 * V1 = skeleton fonctionnel. Le Google Indexing API n'est officiellement
 * supporté QUE pour les jobs JobPosting et BroadcastEvent (cf. doc Google).
 * Pour les pages /actualité ou /article hors ces deux types, Google
 * recommande Search Console URL Inspection + IndexNow (déjà couvert).
 *
 * Le worker ici reste pour future-proof : si Google ouvre l'API à plus de
 * types (request submitted via GSC programmatically), on l'active en flippant
 * une feature flag `GOOGLE_INDEXING_API_ENABLED=true` + JWT credentials
 * GOOGLE_APPLICATION_CREDENTIALS pointant vers une service account.
 *
 * V1 sans credentials → no-op silencieux + log warn.
 */

import { Worker, type Job } from "bullmq";

const QUEUE_NAME = "content-google-indexing";
const ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";

export interface GoogleIndexingJobPayload {
  readonly url: string;
  readonly type: "URL_UPDATED" | "URL_DELETED";
}

async function processJob(job: Job<GoogleIndexingJobPayload>): Promise<void> {
  const { url, type } = job.data;
  const enabled = process.env.GOOGLE_INDEXING_API_ENABLED === "true";
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!enabled || !credentials) {
    console.warn(
      `[google-indexing] skipped (url=${url}, type=${type}) — flag GOOGLE_INDEXING_API_ENABLED ou GOOGLE_APPLICATION_CREDENTIALS manquant. IndexNow couvre déjà Bing/Yandex (cf. content-indexnow-worker).`,
    );
    return;
  }

  // V1.5 : intégration officielle Google Indexing API (JobPosting/BroadcastEvent
  // uniquement). Requires `google-auth-library` npm install + JWT service account
  // signature de la requête. POST { url, type } vers ENDPOINT.
  //
  // Pour V1 on log uniquement la tentative ; activation effective renvoyée
  // Sprint 7+ quand on aura un cas d'usage concret (ex. JobPosting recrutement
  // Axion-IA).
  console.log(
    `[google-indexing] would POST ${ENDPOINT} for ${url} type=${type} (V1.5+ implementation)`,
  );
}

let workerInstance: Worker<GoogleIndexingJobPayload> | null = null;

export function startGoogleIndexingWorker(): Worker<GoogleIndexingJobPayload> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — google-indexing-worker cannot start");
  workerInstance = new Worker<GoogleIndexingJobPayload>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    limiter: { max: 200, duration: 24 * 60 * 60 * 1000 }, // quota Google 200/jour gratuit
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[content-google-indexing-worker] job ${job?.id} failed:`, err);
  });
  return workerInstance;
}

export async function stopGoogleIndexingWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
