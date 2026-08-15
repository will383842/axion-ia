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
 * Idempotency : jobId déterministe (`indexnow-${articleId}-${event}`) pour
 * éviter les doublons d'un ping EN VOL. Fix 2026-08-15 (D5 audit e2e) : cette
 * idempotence ne vaut que pour un job actif/waiting — un job TERMINÉ reste
 * dans Redis (removeOnComplete count 1000) et squattait la clé : le chemin
 * REFRESH (re-publication d'un article existant) repassait ici avec le même
 * articleId + event `publish` par défaut, BullMQ ignorait silencieusement le
 * `add` → un article rafraîchi n'était souvent JAMAIS re-pingé. On applique
 * désormais le motif remove-then-enqueue de `reenqueue-policy` (même doctrine
 * que `enqueueGenJob`, fix 2026-07-17) : jobId STABLE conservé (pas de suffixe
 * horodaté qui rendrait la clé introuvable et empilerait des doublons en vol),
 * mais un job complété/failed est supprimé avant le `add`.
 *
 * Fire-and-forget : ne throw jamais. Tout échec d'enqueue → log warn + continue.
 */

import { Queue, type Job } from "bullmq";
import { buildArticleUrl, type BuildArticleUrlInput } from "./url-builder";
import { isRoutableArticleSlug } from "@/server/content-gen/blog/resolve-article-route";
import {
  resolveReenqueueAction,
  type BullJobState,
} from "@/server/content-gen/queue/reenqueue-policy";
// Fix 2026-08-15 — files créées à la volée : sans defaultJobOptions elles
// héritaient du défaut BullMQ (1 tentative, aucune rétention bornée). Aligné
// sur le module partagé job-options (retries + backoff + retention).
import { CONTENT_GEN_JOB_OPTIONS } from "@/server/content-gen/queue/job-options";

const INDEXNOW_QUEUE = "content-indexnow";
const GOOGLE_INDEXING_QUEUE = "content-google-indexing";

let indexNowQueue: Queue | null = null;
let googleIndexingQueue: Queue | null = null;

function getIndexNowQueue(): Queue | null {
  if (indexNowQueue) return indexNowQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  indexNowQueue = new Queue(INDEXNOW_QUEUE, {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return indexNowQueue;
}

function getGoogleIndexingQueue(): Queue | null {
  if (googleIndexingQueue) return googleIndexingQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  googleIndexingQueue = new Queue(GOOGLE_INDEXING_QUEUE, {
    connection: { url: redisUrl },
    defaultJobOptions: CONTENT_GEN_JOB_OPTIONS,
  });
  return googleIndexingQueue;
}

/**
 * Fix 2026-08-15 (D5) — add avec politique de ré-enfilage. Un `queue.add` sur
 * un jobId dont le job précédent est TERMINÉ (completed/failed, conservé par la
 * rétention) est silencieusement ignoré par BullMQ : le re-ping d'un article
 * rafraîchi n'était donc jamais enfilé. On supprime le job périmé avant le add
 * (motif `resolveReenqueueAction`, cf. reenqueue-policy.ts). Un job encore EN
 * VOL est laissé tel quel (idempotence d'origine préservée) : l'occurrence est
 * couverte par le ping déjà en attente → on répond `true`.
 *
 * Défensif de bout en bout (contrat fire-and-forget du module) : toute erreur
 * de lecture d'état retombe sur le comportement `add` historique.
 */
async function addPingWithReenqueue(
  queue: Queue,
  data: Record<string, unknown>,
  jobId: string,
): Promise<boolean> {
  let existing: Job | undefined;
  let state: BullJobState | null = null;
  try {
    existing = await queue.getJob(jobId);
    state = existing ? ((await existing.getState()) as BullJobState) : null;
  } catch {
    // Lecture d'état impossible (Redis flaky, mock partiel en test) → on
    // retombe sur le add nu, comportement historique.
    existing = undefined;
    state = null;
  }
  const action = resolveReenqueueAction(state);
  if (action === "skip-in-flight") {
    // Un ping identique attend déjà son tour : ne pas doublonner.
    return true;
  }
  if (action === "remove-then-enqueue" && existing) {
    try {
      await existing.remove();
    } catch {
      // Course rarissime (job repris entre getState et remove) : le add
      // no-opera alors comme avant — pas pire que l'ancien comportement.
    }
  }
  await queue.add("ping", data, { jobId });
  return true;
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
  // Fix 2026-08-15 (D8) — garde-fou slug routable : un slug contenant `/`
  // (donnée malformée, cf. incident GSC 2026-07-11) produirait une URL à deux
  // segments qui 404 dur. On ne pinge JAMAIS une telle URL (ping = inviter
  // Google/Bing à crawler un 404).
  if (!isRoutableArticleSlug(input.slug)) {
    console.warn(
      `[indexing-enqueue] slug non routable (contient "/" ou vide) — ping refusé pour article ${input.articleId}: "${input.slug}"`,
    );
    return { url: "", indexnowEnqueued: false, googleEnqueued: false };
  }

  const url = buildArticleUrl(input);
  const event: IndexingLifecycleEvent = input.lifecycleEvent ?? "publish";

  let indexnowEnqueued = false;
  let googleEnqueued = false;

  // IndexNow — toujours actif si key présent (ignore le type d'event, ping unique)
  if (process.env.INDEXNOW_KEY) {
    const queue = getIndexNowQueue();
    if (queue) {
      try {
        // jobId suffixé event pour permettre re-ping si lifecycle change rapidement
        // (publish → delete dans la même fenêtre BullMQ). Fix 2026-08-15 (D5) :
        // remove-then-enqueue pour qu'un REFRESH (même articleId, même event)
        // soit re-pingé au lieu d'être avalé par la clé du job complété.
        indexnowEnqueued = await addPingWithReenqueue(
          queue,
          { urls: [url], origin: input.origin },
          `indexnow-${input.articleId}-${event}`,
        );
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
        googleEnqueued = await addPingWithReenqueue(
          queue,
          { url, type: eventToGoogleType(event) },
          `google-indexing-${input.articleId}-${event}`,
        );
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
        // Fix 2026-08-15 (D5) — même motif remove-then-enqueue que le chemin article.
        indexnowEnqueued = await addPingWithReenqueue(
          queue,
          { urls: validUrls, origin: input.origin },
          `indexnow-${input.entityId}-${event}`,
        );
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
          const added = await addPingWithReenqueue(
            queue,
            { url, type },
            `google-indexing-${input.entityId}-${i}-${event}`,
          );
          googleEnqueued = googleEnqueued || added;
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
      const added = await addPingWithReenqueue(
        queue,
        { url, type },
        `google-indexing-${input.entityId}-${i}-${event}`,
      );
      googleEnqueued = googleEnqueued || added;
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
