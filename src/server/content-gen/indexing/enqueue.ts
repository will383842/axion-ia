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
 *     ET `GOOGLE_INDEXING_SA_JSON` set (cf. worker skeleton V1).
 *     SSOT env vars aligné audit indexation 2026-05-15 P0-9.
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

/**
 * Type de cycle de vie URL — audit indexation 2026-05-15 P0-6.
 *
 * Mapping vers Google Indexing API `urlNotifications:publish` :
 *   - `publish` / `update` → `URL_UPDATED` (signal Google : page existe / a changé)
 *   - `delete`             → `URL_DELETED` (signal Google : page disparue ; désindexation ~24h vs ~6 mois en 404)
 *
 * IndexNow ignore cette distinction (un ping = "vérifie cette URL"). Le mapping
 * sert uniquement à Google Indexing API. Permet aux callers
 * `archiveArticle/deleteArticle/demoteArticle/rollbackArticle` de signaler
 * proprement une désindexation au lieu de hardcoder `URL_UPDATED`.
 */
export type IndexingLifecycleEvent = "publish" | "update" | "delete";

function eventToGoogleType(event: IndexingLifecycleEvent): "URL_UPDATED" | "URL_DELETED" {
  return event === "delete" ? "URL_DELETED" : "URL_UPDATED";
}

export interface EnqueueIndexingInput extends BuildArticleUrlInput {
  /** Identifiant article — sert de seed déterministe pour les jobIds BullMQ. */
  readonly articleId: string;
  /** Source du déclenchement, pour les logs/audit. */
  readonly origin: "content-gen" | "manual" | "cron" | "tier-promote";
  /**
   * Type de transition cycle de vie. Défaut `publish` (rétro-compatible) →
   * Google Indexing `URL_UPDATED`. Passer `delete` pour archive/demote/delete/rollback
   * → Google Indexing `URL_DELETED`. Audit indexation 2026-05-15 P0-6.
   */
  readonly lifecycleEvent?: IndexingLifecycleEvent;
}

export interface EnqueueIndexingResult {
  readonly url: string;
  readonly indexnowEnqueued: boolean;
  readonly googleEnqueued: boolean;
}

/**
 * Enqueue les pings indexing pour un article. Toujours safe (fire-and-forget).
 *
 * Note : le nom reste `enqueueIndexingForTier1` pour rétro-compatibilité avec les
 * 7+ callers existants. Le helper accepte désormais `lifecycleEvent: "delete"`
 * pour signaler proprement une désindexation (archive/delete/demote/rollback),
 * audit indexation 2026-05-15 P0-6.
 */
export async function enqueueIndexingForTier1(
  input: EnqueueIndexingInput,
): Promise<EnqueueIndexingResult> {
  const url = buildArticleUrl(input);
  const event: IndexingLifecycleEvent = input.lifecycleEvent ?? "publish";

  let indexnowEnqueued = false;
  let googleEnqueued = false;

  // IndexNow — toujours actif si key présent (ignore le type d'event, ping unique)
  if (process.env.INDEXNOW_KEY) {
    const queue = getIndexNowQueue();
    if (queue) {
      try {
        await queue.add(
          "ping",
          { urls: [url], origin: input.origin },
          // jobId suffixé event pour permettre re-ping si lifecycle change rapidement
          // (publish → delete dans la même fenêtre BullMQ).
          { jobId: `indexnow-${input.articleId}-${event}` },
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

  // Google Indexing API — l'API n'honore officiellement QUE JobPosting /
  // BroadcastEvent. Pour un ARTICLE, Google accepte le ping (200) mais
  // n'indexe rien → quota 200/j gaspillé (les offres en ont besoin) + hors ToS
  // (risque de révocation). On exige donc un opt-in EXPLICITE distinct
  // `GOOGLE_INDEXING_ARTICLES=true` (default off), EN PLUS du master
  // `GOOGLE_INDEXING_API_ENABLED`. Conséquence : activer le master (pour Google
  // for Jobs, cf. `enqueueGoogleIndexingForUrls`) ne fait PAS pinger les articles.
  const googleEnabled =
    process.env.GOOGLE_INDEXING_API_ENABLED === "true" &&
    process.env.GOOGLE_INDEXING_ARTICLES === "true";
  if (googleEnabled) {
    const queue = getGoogleIndexingQueue();
    if (queue) {
      try {
        await queue.add(
          "ping",
          { url, type: eventToGoogleType(event) },
          { jobId: `google-indexing-${input.articleId}-${event}` },
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

/**
 * Variante bas-niveau : enqueue les pings indexing pour une liste d'URLs déjà
 * construites (utile pour KB V4 qui a son propre `buildKbPublicUrl()`).
 * Audit indexation 2026-05-15 P0-4.
 *
 * Toujours safe (fire-and-forget). N'échoue jamais.
 */
export interface EnqueueIndexingForUrlsInput {
  /** Identifiant logique de l'entité (pour jobId déterministe). */
  readonly entityId: string;
  /** URLs absolues à pinger (ex. `https://axion-ia.com/fr/blog/...`). */
  readonly urls: ReadonlyArray<string>;
  /** Source du déclenchement, pour les logs/audit. */
  readonly origin: "content-gen" | "manual" | "cron" | "tier-promote";
  /** Type de transition. Défaut `publish`. */
  readonly lifecycleEvent?: IndexingLifecycleEvent;
}

export async function enqueueIndexingForUrls(
  input: EnqueueIndexingForUrlsInput,
): Promise<{ indexnowEnqueued: boolean; googleEnqueued: boolean }> {
  const validUrls = input.urls.filter((u) => typeof u === "string" && u.length > 0);
  if (validUrls.length === 0) return { indexnowEnqueued: false, googleEnqueued: false };

  const event: IndexingLifecycleEvent = input.lifecycleEvent ?? "publish";

  let indexnowEnqueued = false;
  let googleEnqueued = false;

  // IndexNow — batch unique avec toutes les URLs (le worker gère MAX 10K par batch)
  if (process.env.INDEXNOW_KEY) {
    const queue = getIndexNowQueue();
    if (queue) {
      try {
        await queue.add(
          "ping",
          { urls: validUrls, origin: input.origin },
          { jobId: `indexnow-${input.entityId}-${event}` },
        );
        indexnowEnqueued = true;
      } catch (err) {
        console.warn(
          `[indexing-enqueue] indexnow batch failed for ${input.entityId}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  // Google Indexing API — chemin CONTENU (articles/KB). Même garde que
  // `enqueueIndexingForTier1` : opt-in explicite `GOOGLE_INDEXING_ARTICLES=true`
  // en plus du master (Google ignore les non-JobPosting → ne pas brûler le
  // quota). 1 job par URL (quota 200/jour réparti par appel).
  const googleEnabled =
    process.env.GOOGLE_INDEXING_API_ENABLED === "true" &&
    process.env.GOOGLE_INDEXING_ARTICLES === "true";
  if (googleEnabled) {
    const queue = getGoogleIndexingQueue();
    if (queue) {
      const type = eventToGoogleType(event);
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        if (typeof url !== "string") continue;
        try {
          await queue.add(
            "ping",
            { url, type },
            { jobId: `google-indexing-${input.entityId}-${i}-${event}` },
          );
          googleEnqueued = true;
        } catch (err) {
          console.warn(
            `[indexing-enqueue] google-indexing add failed for ${input.entityId} url ${url}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }
  }

  return { indexnowEnqueued, googleEnqueued };
}

/**
 * Variante GOOGLE-ONLY : enqueue uniquement l'Indexing API Google (pas IndexNow)
 * pour une liste d'URLs déjà construites. Utile quand IndexNow est déjà pingé par
 * un autre canal (ex. offres d'emploi via `pingIndexNow` synchrone) et qu'on veut
 * AJOUTER Google sans doublonner le ping IndexNow.
 *
 * Cas d'usage principal : `JobPosting` — l'un des deux seuls types que Google
 * honore officiellement via l'Indexing API (avec `BroadcastEvent`). Contrairement
 * aux Articles, pinger une offre d'emploi ici a un effet réel sur Google for Jobs.
 *
 * Gardé par `GOOGLE_INDEXING_API_ENABLED === "true"` : no-op complet sinon.
 * Toujours safe (fire-and-forget). N'échoue jamais.
 */
export async function enqueueGoogleIndexingForUrls(
  input: EnqueueIndexingForUrlsInput,
): Promise<{ googleEnqueued: boolean }> {
  if (process.env.GOOGLE_INDEXING_API_ENABLED !== "true") {
    return { googleEnqueued: false };
  }
  const validUrls = input.urls.filter((u) => typeof u === "string" && u.length > 0);
  if (validUrls.length === 0) return { googleEnqueued: false };

  const event: IndexingLifecycleEvent = input.lifecycleEvent ?? "publish";
  const queue = getGoogleIndexingQueue();
  if (!queue) return { googleEnqueued: false };

  const type = eventToGoogleType(event);
  let googleEnqueued = false;
  for (let i = 0; i < validUrls.length; i++) {
    const url = validUrls[i];
    if (typeof url !== "string") continue;
    try {
      await queue.add(
        "ping",
        { url, type },
        { jobId: `google-indexing-${input.entityId}-${i}-${event}` },
      );
      googleEnqueued = true;
    } catch (err) {
      console.warn(
        `[indexing-enqueue] google-only add failed for ${input.entityId} url ${url}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return { googleEnqueued };
}

/** Test-only : reset les singletons queue (sinon les mocks BullMQ leakent entre tests). */
export function _resetIndexingQueuesForTest(): void {
  indexNowQueue = null;
  googleIndexingQueue = null;
}
