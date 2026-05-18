/**
 * Content Generator — Google Indexing API worker (§ 9bis.1 v1.7 + V2 OAuth 2026-05-15).
 *
 * V2 (2026-05-15) : activation effective via OAuth refresh_token flow (cohérent
 * gsc-keyword-sync-worker). Le client OAuth Desktop est partagé avec GSC
 * (projet GCP `axion-ia-seo`), seul le `INDEXING_OAUTH_REFRESH_TOKEN` est
 * dédié au scope `auth/indexing`.
 *
 * **LIMITE OFFICIELLE GOOGLE** : l'API n'accepte que `JobPosting` et
 * `BroadcastEvent`. Pour les Articles/FAQ/Cas concrets, Google retourne 200
 * mais ne change rien à l'indexation vs sitemap. IndexNow couvre déjà
 * Bing/Yandex/Naver/Seznam (cf. content-indexnow-worker).
 *
 * Worker fail-soft : si credentials absents OU API skip-côté-Google, on log
 * et on continue (pas de retry exponentiel inutile).
 */

import { Worker, type Job } from "bullmq";
import { readContentGenConfig } from "@/server/actions/content-gen/_settings";
import { indexingPublishUrl, isIndexingApiReady } from "@/server/content-gen/seo/indexing-client";

const QUEUE_NAME = "content-google-indexing";

export interface GoogleIndexingJobPayload {
  readonly url: string;
  readonly type: "URL_UPDATED" | "URL_DELETED";
}

async function processJob(job: Job<GoogleIndexingJobPayload>): Promise<void> {
  const { url, type } = job.data;

  // Audit 2026-05-15 P1-8 — kill-switch check (cohérence avec indexnow worker).
  const killSwitch = await readContentGenConfig<{ active: boolean }>("kill_switch", {
    active: false,
  });
  if (killSwitch.active) {
    console.log(`[google-indexing] kill switch active, skip ${url} type=${type}`);
    return;
  }

  if (!isIndexingApiReady()) {
    console.warn(
      `[google-indexing] skipped (url=${url}, type=${type}) — INDEXING_OAUTH_REFRESH_TOKEN ou GSC_OAUTH_CLIENT_* manquant. IndexNow couvre déjà Bing/Yandex (cf. content-indexnow-worker).`,
    );
    return;
  }

  const ok = await indexingPublishUrl(url, type);
  if (ok) {
    console.log(`[google-indexing] published ${url} type=${type}`);
  } else {
    // indexingPublishUrl log déjà le détail — pas de retry car payload
    // valide a échoué (4xx) ou OAuth invalide ; retry exponentiel ferait
    // pire (rate-limit + 1 quota brûlé par tentative).
    console.warn(
      `[google-indexing] publish failed for ${url} type=${type} — see indexing-client log`,
    );
  }
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
    // P2-23 audit indexation 2026-05-18 — bornage retention Redis :
    // garde 1000 jobs completed + 5000 jobs failed max (BullMQ purge auto).
    // Évite saturation Redis long-terme sur high-volume workers.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
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
