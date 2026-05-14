// BullMQ queue producers (Sprint 15 / M8 step 4).
//
// Pattern : on declare les queues une seule fois, on les exporte pour que
// les Server Actions puissent enqueue sans toucher a BullMQ directement.
//
// Toggle dev : si `BULLMQ_DISABLED=true`, toutes les queues sont `null` et
// les helpers `enqueueEmail` / `bootRepeatableJobs` no-op proprement.

import { Queue } from "bullmq";
import { getBullConnection, isBullmqDisabled } from "./connection";
import type {
  EmailJobData,
  EmailJobName,
  OptionExpirationJobData,
  OptionReminderJobData,
  NewsletterCampaignJobData,
  SearchIndexerJobData,
  RetentionPurgeJobData,
  BookingCronJobData,
  BookingCronJobType,
} from "./types";

const connection = getBullConnection();

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
};

export const emailsQueue: Queue<EmailJobData, void, EmailJobName> | null = connection
  ? new Queue<EmailJobData, void, EmailJobName>("emails", { connection, defaultJobOptions })
  : null;

export const optionExpirationQueue: Queue<OptionExpirationJobData> | null = connection
  ? new Queue<OptionExpirationJobData>("option-expiration", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

export const optionReminderQueue: Queue<OptionReminderJobData> | null = connection
  ? new Queue<OptionReminderJobData>("option-reminder", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

export const newsletterQueue: Queue<NewsletterCampaignJobData> | null = connection
  ? new Queue<NewsletterCampaignJobData>("newsletter", { connection, defaultJobOptions })
  : null;

export const searchIndexerQueue: Queue<SearchIndexerJobData> | null = connection
  ? new Queue<SearchIndexerJobData>("search-indexer", { connection, defaultJobOptions })
  : null;

// Sprint 24 / D3 — purge RGPD quotidienne (cron 03:00 UTC).
export const retentionPurgeQueue: Queue<RetentionPurgeJobData> | null = connection
  ? new Queue<RetentionPurgeJobData>("retention-purge", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

// Sprint X.12 — Booking V1 crons (relances paiement, J-7/J-1 reminders, etc.).
// 1 seule queue qui dispatche par `type`. `attempts: 3` — fail-soft sur DB
// temporaire mais pas d'accumulation infinie.
export const bookingCronsQueue: Queue<BookingCronJobData, void, BookingCronJobType> | null =
  connection
    ? new Queue<BookingCronJobData, void, BookingCronJobType>("booking-crons", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      })
    : null;

// ============================================================
// Content Generator V1 — Sprint 4/5 queues (§ 13.1 master prompt v1.7)
// ============================================================
//
// Toutes les queues content-gen utilisent `attempts: 3` par défaut (fail-soft
// sur API IA / Redis temporairement indisponible). Les workers correspondants
// vivent sous `src/server/queue/workers/content-*-worker.ts` et leurs
// `startXxxWorker()` doivent être appelés depuis `src/server/queue/worker.ts`
// au démarrage du process worker.

/** Worker primaire — pick ContentGenJob, lance generator, écrit ReviewQueue. */
export const contentGenQueue: Queue | null = connection
  ? new Queue("content-gen", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

/** Orchestrateur — pick CoverageCampaign running, crée ContentGenJob rows. */
export const contentOrchestratorQueue: Queue | null = connection
  ? new Queue("content-orchestrator", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** Boucle qualité — re-prompt sections sous-score (§ 27 v1.7). */
export const contentQualityImproverQueue: Queue | null = connection
  ? new Queue("content-quality-improver", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/** RSS fetch — poll sources RSS configurées (§ 28 v1.7). */
export const contentRssFetchQueue: Queue | null = connection
  ? new Queue("content-rss-fetch", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** Similarity monitor — cron quotidien Jaccard scan (§ 25.5 v1.7). */
export const contentSimilarityMonitorQueue: Queue | null = connection
  ? new Queue("content-similarity-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** News lifecycle — cron quotidien archive RSS > 90j (§ 28.1 v1.7). */
export const contentNewsLifecycleQueue: Queue | null = connection
  ? new Queue("content-news-lifecycle", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** Publish — insère Article DB après review approuvée (§ 14.1 v1.7). */
export const contentPublishQueue: Queue | null = connection
  ? new Queue("content-publish", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

/** IndexNow — POST api.indexnow.org à chaque publication tier-1 (§ 9bis.1). */
export const contentIndexNowQueue: Queue | null = connection
  ? new Queue("content-indexnow", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Q/R post-process auto (§ 29 master prompt v1.7 — Pass B fix P0-7).
 *
 * Hook post-publish : pour chaque article content-gen publié, extraire les
 * 8 Q/R du payload (faqJson) et créer une FAQ row par Q/R avec
 * `isAutoGenerated=true` + `parentArticleId`. URL plate `/fr/faq/<slug>`.
 * Anti-thin HCU : enrichment ≥ 300 mots requis V1.5+ (V1 = skeleton).
 */
export const contentQaExtractQueue: Queue | null = connection
  ? new Queue("content-qa-extract", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Fact-check Perplexity (Sprint 12.5 V2).
 *
 * Hook post-publish : pour chaque article publié, extrait claims chiffrés
 * (%, montants, ratios, attributions) et appelle Perplexity Sonar pour
 * valider/refuter. Remplit Article.factCheckScore. Coût ~$0.005/article.
 */
export const contentFactCheckQueue: Queue | null = connection
  ? new Queue("content-fact-check", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Tier lifecycle (Sprint 10 V2) — cron mensuel 15 du mois 06:00 UTC.
 * Scan les Articles tier-2 publiés ≥ 30j (promote candidates CTR > 5 %) +
 * tier-1 publiés ≥ 60j (demote candidates CTR < 1 %). Lit GSC API (skeleton
 * V1, activation Sprint 10.5 quand credentials JWT fournis par Will).
 */
export const contentTierLifecycleQueue: Queue | null = connection
  ? new Queue("content-tier-lifecycle", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Keyword sync (Sprint 12.5 V2) — cron hebdo lundi 04:00 UTC.
 * Query GSC API + SerpAPI pour chaque article publié ≥ 7j → upsert
 * KeywordTracking rows (position, CTR, impressions, clicks, delta).
 * SKELETON V1 (skip silencieux sans credentials).
 */
export const contentKeywordSyncQueue: Queue | null = connection
  ? new Queue("content-keyword-sync", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

// ============================================================
// Helpers d'enqueue typés (utilises par Server Actions)
// ============================================================

export async function enqueueEmail(
  template: EmailJobName,
  to: string,
  locale: "fr" | "en",
  payload: Record<string, unknown>,
  options?: { delayMs?: number; marketing?: boolean },
): Promise<void> {
  if (!emailsQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(`[bullmq] no connection, skipping enqueueEmail(${template}, ${to})`);
    }
    return;
  }
  const data: EmailJobData = options?.marketing
    ? { template, to, locale, payload, marketing: true }
    : { template, to, locale, payload };
  const addOptions = options?.delayMs ? { delay: options.delayMs } : undefined;
  await emailsQueue.add(template, data, addOptions);
}

/**
 * Boot des cron jobs recurrents — appele une seule fois au demarrage du
 * worker (`pnpm worker`). Utilise des repeatable jobs BullMQ.
 *
 * Sprint 15 fix Fork 1 W2 : avant `add()` on supprime tout repeat existant
 * pour le meme jobId (idempotence en HA scaling — sinon plusieurs workers
 * accumulent des entrees dans repeat: ZSET).
 */
export async function bootRepeatableJobs(): Promise<void> {
  if (!optionExpirationQueue || !optionReminderQueue || !retentionPurgeQueue) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[bullmq] no connection, skipping bootRepeatableJobs");
    }
    return;
  }

  // Cron 5min : libere les options 48h expirees
  await optionExpirationQueue.removeRepeatable(
    "tick",
    { pattern: "*/5 * * * *" },
    "option-expiration-cron",
  );
  await optionExpirationQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { repeat: { pattern: "*/5 * * * *" }, jobId: "option-expiration-cron" },
  );

  // Cron 1h : envoie rappel H+24 (fenetre [22h,26h] post-fix Fork 1 C3)
  await optionReminderQueue.removeRepeatable(
    "tick",
    { pattern: "0 * * * *" },
    "option-reminder-cron",
  );
  await optionReminderQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { repeat: { pattern: "0 * * * *" }, jobId: "option-reminder-cron" },
  );

  // Sprint 24 / D3 — RGPD purge quotidienne 03:00 UTC.
  await retentionPurgeQueue.removeRepeatable(
    "tick",
    { pattern: "0 3 * * *" },
    "retention-purge-cron",
  );
  await retentionPurgeQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { repeat: { pattern: "0 3 * * *" }, jobId: "retention-purge-cron" },
  );

  // Sprint X.12 — Booking V1 crons.
  if (bookingCronsQueue) {
    // Liste des cron jobs Booking V1 — pattern, jobId, type.
    // Most jobs run daily 09:00 (Europe/Paris ≈ 07:00-08:00 UTC selon DST).
    // Cadrage-h2-reminder = hourly.
    const bookingCronSchedule: Array<{
      type: BookingCronJobType;
      pattern: string;
      jobId: string;
    }> = [
      { type: "payment-overdue-scan", pattern: "0 8 * * *", jobId: "payment-overdue-scan-cron" },
      { type: "booking-j7-reminder", pattern: "0 8 * * *", jobId: "booking-j7-reminder-cron" },
      { type: "booking-j1-reminder", pattern: "0 8 * * *", jobId: "booking-j1-reminder-cron" },
      { type: "cadrage-j1-reminder", pattern: "0 8 * * *", jobId: "cadrage-j1-reminder-cron" },
      { type: "cadrage-h2-reminder", pattern: "0 * * * *", jobId: "cadrage-h2-reminder-cron" },
      {
        type: "contract-pending-reminder",
        pattern: "30 8 * * *",
        jobId: "contract-pending-reminder-cron",
      },
      {
        type: "quote-pending-reminder",
        pattern: "30 8 * * *",
        jobId: "quote-pending-reminder-cron",
      },
      {
        type: "quote-expiration-check",
        pattern: "30 8 * * *",
        jobId: "quote-expiration-check-cron",
      },
      {
        type: "contract-signed-without-deposit-cutoff",
        pattern: "30 8 * * *",
        jobId: "contract-signed-without-deposit-cutoff-cron",
      },
      {
        type: "booking-paused-resume-reminder",
        pattern: "0 9 * * *",
        jobId: "booking-paused-resume-reminder-cron",
      },
      {
        type: "booking-completed-thanks-sweep",
        pattern: "0 18 * * *",
        jobId: "booking-completed-thanks-sweep-cron",
      },
    ];

    for (const { type, pattern, jobId } of bookingCronSchedule) {
      await bookingCronsQueue.removeRepeatable(type, { pattern }, jobId);
      await bookingCronsQueue.add(
        type,
        { type, tick: new Date().toISOString() },
        { repeat: { pattern }, jobId },
      );
    }
  }

  // ============================================================
  // Content Generator V1 — crons content-gen (§ 13.2 master prompt v1.7)
  // ============================================================
  //
  // 5 crons content-gen :
  //  - orchestrator : toutes les 15 min — pick CoverageCampaign running, enqueue ContentGenJob
  //  - rss-fetch : toutes les heures — poll sources RSS
  //  - similarity-monitor : quotidien 04:30 UTC — Jaccard scan top 100 pairs
  //  - news-lifecycle : quotidien 05:00 UTC — archive RSS > 90j
  //
  // Le worker primaire (`content-gen`) + publish + quality-improver + indexnow
  // sont event-driven (pas de cron — déclenchés via enqueue depuis Server Actions
  // ou autres workers).

  if (contentOrchestratorQueue) {
    await contentOrchestratorQueue.removeRepeatable(
      "tick",
      { pattern: "*/15 * * * *" },
      "content-orchestrator-cron",
    );
    await contentOrchestratorQueue.add(
      "tick",
      { trigger: "cron-15min", tick: new Date().toISOString() },
      { repeat: { pattern: "*/15 * * * *" }, jobId: "content-orchestrator-cron" },
    );
  }

  if (contentRssFetchQueue) {
    await contentRssFetchQueue.removeRepeatable(
      "tick",
      { pattern: "0 * * * *" },
      "content-rss-fetch-cron",
    );
    await contentRssFetchQueue.add(
      "tick",
      { trigger: "cron-hourly", tick: new Date().toISOString() },
      { repeat: { pattern: "0 * * * *" }, jobId: "content-rss-fetch-cron" },
    );
  }

  if (contentSimilarityMonitorQueue) {
    await contentSimilarityMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "30 4 * * *" },
      "content-similarity-monitor-cron",
    );
    await contentSimilarityMonitorQueue.add(
      "tick",
      { trigger: "cron-daily-0430", tick: new Date().toISOString() },
      { repeat: { pattern: "30 4 * * *" }, jobId: "content-similarity-monitor-cron" },
    );
  }

  if (contentNewsLifecycleQueue) {
    await contentNewsLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 5 * * *" },
      "content-news-lifecycle-cron",
    );
    await contentNewsLifecycleQueue.add(
      "tick",
      { trigger: "cron-daily-0500", tick: new Date().toISOString() },
      { repeat: { pattern: "0 5 * * *" }, jobId: "content-news-lifecycle-cron" },
    );
  }

  // Sprint 10 V2 — tier-lifecycle mensuel (15 du mois 06:00 UTC).
  if (contentTierLifecycleQueue) {
    await contentTierLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 15 * *" },
      "content-tier-lifecycle-cron",
    );
    await contentTierLifecycleQueue.add(
      "tick",
      { trigger: "cron-monthly-15-0600", tick: new Date().toISOString() },
      { repeat: { pattern: "0 6 15 * *" }, jobId: "content-tier-lifecycle-cron" },
    );
  }

  // Sprint 12.5 V2 — keyword sync hebdo (lundi 04:00 UTC).
  if (contentKeywordSyncQueue) {
    await contentKeywordSyncQueue.removeRepeatable(
      "tick",
      { pattern: "0 4 * * 1" },
      "content-keyword-sync-cron",
    );
    await contentKeywordSyncQueue.add(
      "tick",
      { trigger: "cron-weekly-mon-0400", tick: new Date().toISOString() },
      { repeat: { pattern: "0 4 * * 1" }, jobId: "content-keyword-sync-cron" },
    );
  }
}
