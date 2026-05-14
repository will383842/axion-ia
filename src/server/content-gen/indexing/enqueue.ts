/**
 * Content Generator — Indexing enqueue helper (Sprint 9 V2).
 *
 * Centralise l'enqueue des pings indexing (IndexNow + Google Indexing API)
 * pour les articles tier-1 indexables. Réutilisable depuis :
 *   - content-publish-worker (tier-1 manuel via review.promoteToTier1)
 *   - tier-lifecycle-worker (Sprint 10 auto-promote sur CTR > seuil)
 *
 * Doctrine :
 *   - IndexNow (Bing) : enqueue systématique si `INDEXNOW_KEY` set (~free)
 *   - Google Indexing API : enqueue seulement si `GOOGLE_INDEXING_API_ENABLED=true`
 *     ET `GOOGLE_APPLICATION_CREDENTIALS` set (cf. worker skeleton V1)
 *
 * Idempotency : utilise `jobId` déterministe (`indexing-${articleId}-${kind}`)
 * pour éviter doublons si re-enqueued. BullMQ dédoublonne sur jobId.
 *
 * Fire-and-forget : ne throw jamais. Tout échec d'enqueue → log warn + continue.
 */

import { Queue } from "bullmq";
import { buildArticleUrl, type BuildArticleUrlInput } from "./url-builder";

const INDEXNOW_QUEUE = "content-indexnow";
const GOOGLE_INDEXING_QUEUE = "content-google-indexing";

let indexNowQueue: Queue | null = null;
let googleIndexingQueue: Queue | null = null;

function getIndexNowQueue(): Queue | null {
  if (indexNowQueue) return indexNowQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  indexNowQueue = new Queue(INDEXNOW_QUEUE, { connection: { url: redisUrl } });
  return indexNowQueue;
}

function getGoogleIndexingQueue(): Queue | null {
  if (googleIndexingQueue) return googleIndexingQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  googleIndexingQueue = new Queue(GOOGLE_INDEXING_QUEUE, { connection: { url: redisUrl } });
  return googleIndexingQueue;
}

export interface EnqueueIndexingInput extends BuildArticleUrlInput {
  /** Identifiant article — sert de seed déterministe pour les jobIds BullMQ. */
  readonly articleId: string;
  /** Source du déclenchement, pour les logs/audit. */
  readonly origin: "content-gen" | "manual" | "cron" | "tier-promote";
}

export interface EnqueueIndexingResult {
  readonly url: string;
  readonly indexnowEnqueued: boolean;
  readonly googleEnqueued: boolean;
}

/**
 * Enqueue les pings indexing pour un article tier-1. Toujours safe (fire-and-forget).
 */
export async function enqueueIndexingForTier1(
  input: EnqueueIndexingInput,
): Promise<EnqueueIndexingResult> {
  const url = buildArticleUrl(input);

  let indexnowEnqueued = false;
  let googleEnqueued = false;

  // IndexNow — toujours actif si key présent
  if (process.env.INDEXNOW_KEY) {
    const queue = getIndexNowQueue();
    if (queue) {
      try {
        await queue.add(
          "ping",
          { urls: [url], origin: input.origin },
          { jobId: `indexnow-${input.articleId}` },
        );
        indexnowEnqueued = true;
      } catch (err) {
        console.warn(
          `[indexing-enqueue] indexnow add failed for article ${input.articleId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // Google Indexing API — gated par flag explicite
  const googleEnabled = process.env.GOOGLE_INDEXING_API_ENABLED === "true";
  if (googleEnabled) {
    const queue = getGoogleIndexingQueue();
    if (queue) {
      try {
        await queue.add(
          "ping",
          { url, type: "URL_UPDATED" as const },
          { jobId: `google-indexing-${input.articleId}` },
        );
        googleEnqueued = true;
      } catch (err) {
        console.warn(
          `[indexing-enqueue] google-indexing add failed for article ${input.articleId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return { url, indexnowEnqueued, googleEnqueued };
}

/** Test-only : reset les singletons queue (sinon les mocks BullMQ leakent entre tests). */
export function _resetIndexingQueuesForTest(): void {
  indexNowQueue = null;
  googleIndexingQueue = null;
}
