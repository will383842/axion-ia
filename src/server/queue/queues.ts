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
  SiteRouteInspectorJobData,
  SiteRouteAnomalyDetectorJobData,
} from "./types";
import type { ImageBankEnrichJobData } from "./workers/image-bank-enrich-worker";
import type { ImageBankImportJobData } from "./workers/image-bank-import-worker";
import type { ImageBankTranslateJobData } from "./workers/image-bank-translate-worker";
import type { ImageBankCronJobData, ImageBankCronJobType } from "./workers/image-bank-crons-worker";
import type { ImageBankAutoConvertJobData } from "./workers/image-bank-auto-convert-worker";
import { AUTO_CONVERT_QUEUE_NAME } from "@/server/image-bank/constants";

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

/**
 * Web Vitals monitor (audit final fix P0-3) — cron daily 02:30 UTC.
 * Calcule p75 LCP/INP/CLS/FCP/TTFB/TBT sur fenêtre 24h depuis
 * `WebVitalSample` table (RUM /api/vitals). Alerte Telegram tag
 * MONITORING si dépasse budget AGENTS.md. Snapshot stocké dans
 * ContentGenConfig.web_vitals_p75 pour dashboard admin.
 */
export const contentWebVitalsMonitorQueue: Queue | null = connection
  ? new Queue("content-web-vitals-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * P2-29 (audit re-run 2026-05-15 AGENT 8) — PSI weekly monitor.
 * Cron Monday 03:00 UTC. Query PSI mobile sur 15 URLs stratégiques, persiste
 * dans WebVitalSample (navigationType=psi-lab), alerte Telegram si
 * Δ p75 PSI vs RUM > 50 %.
 */
export const contentPsiMonitorQueue: Queue | null = connection
  ? new Queue("content-psi-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint A 2026-05-21 D-P5-3 — Rapport qualité hebdomadaire content-gen.
 * Cron lundi 7h00 UTC (≈ 8h CET). KPIs publiés/rejetés/coût/villes/anomalies.
 * Destinataire : WEEKLY_REPORT_EMAIL env var (défaut williamsjullin@gmail.com).
 */
export const contentWeeklyReportQueue: Queue | null = connection
  ? new Queue("content-weekly-report", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.2
 * Scheduler worker — cron every-5min — startDate → running.
 */
export const contentSchedulerQueue: Queue | null = connection
  ? new Queue("content-gen-scheduler", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.3
 * Deadline checker worker — cron 5 0 * * * — endDate auto-stop.
 */
export const contentDeadlineCheckerQueue: Queue | null = connection
  ? new Queue("content-gen-deadline-checker", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Phase F Sprint Perfection 2026 — Embeddings backfill daily 03:00 UTC.
 * Backfille les embeddings OpenAI (text-embedding-3-large, 1536 dims)
 * sur les articles publiés sans embedding (couche 4 dédup sémantique B.7).
 * Gate : OPENAI_EMBEDDINGS_ENABLED=true requis (défaut false).
 * Limite : 1 000 articles/run, cap OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY.
 */
export const embeddingsBackfillQueue: Queue | null = connection
  ? new Queue("embeddings-backfill", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint H 2026-05-22 — Brand Voice Drift Monitor (cron daily 04:00 UTC).
 * Calcule la similarité cosine embeddings article vs référence brand voice.
 * Alerte (needs_review) si < 0.70, drift warning si < 0.80.
 */
export const brandVoiceDriftMonitorQueue: Queue | null = connection
  ? new Queue("brand-voice-drift-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Phase 8 Sprint Keywords Perfection 2026-05-22 — Keyword opportunity detector (cron lundi 06:00 UTC).
 * Détecte les keywords position > 10 avec opportunité 'high' + alertes rank-drop.
 */
export const keywordOpportunityDetectorQueue: Queue | null = connection
  ? new Queue("keyword-opportunity-detector", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint Final 2026-05-22 (P0-2 audit final) — Reset monthly cost counters cron
 * (1er du mois à 00:00 UTC). Sans ce cron, `resetMonthlyCostCounters()` n'est
 * jamais appelé, le compteur Redis du mois courant s'accumule indéfiniment et
 * le kill-switch global content-gen se déclenche à perpétuité dès le 1er mois.
 */
export const costCapResetQueue: Queue | null = connection
  ? new Queue("cost-cap-reset", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint Final 2026-05-22 (P0-3 audit final) — External links monthly HEAD
 * check cron (1er du mois à 02:00 UTC). Worker existait depuis Sprint External
 * Links Database 2026-05-22 mais n'avait pas de cron déclencheur.
 * Gate `EXTERNAL_LINKS_MONITOR_ENABLED=true` requise côté worker (no-op sinon).
 */
export const externalLinksMonitorQueue: Queue | null = connection
  ? new Queue("external-links-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

// Sprint Site Explorer Admin 2026-05-22 — inspection quotidienne + détection anomalies.
export const siteRouteInspectorQueue: Queue<SiteRouteInspectorJobData> | null = connection
  ? new Queue<SiteRouteInspectorJobData>("site-route-inspector", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

export const siteRouteAnomalyDetectorQueue: Queue<SiteRouteAnomalyDetectorJobData> | null =
  connection
    ? new Queue<SiteRouteAnomalyDetectorJobData>("site-route-anomaly-detector", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
      })
    : null;

/**
 * Méta-cert 2026-05-15 AGENT 19 — health monitoring multi-check (cron hourly).
 * Câble les helpers Telegram ready-to-call non-câblés :
 *  - `alertQueueStuck` (BullMQ waiting count stable > 30 min)
 *  - `alertSoft404Detected` (link-checker tier-1 HEAD samples)
 *  - `alertIndexationStagnant` (Article tier_1 sans `indexedAt` > 30 j)
 *
 * Cron pattern : `15 * * * *` (xx:15 every hour, décalé pour ne pas
 * coïncider avec content-orchestrator-cron à xx:00 / xx:15 / xx:30 / xx:45.
 */
export const contentMonitoringQueue: Queue | null = connection
  ? new Queue("content-monitoring", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

// ============================================================
// Image Bank V1 (Sprint 1-7 feat/image-bank-v1) — 4 queues
// Patch post-audit 2026-05-16 P1-2 + P1-4 (activation + retry/backoff).
// Constants : src/server/image-bank/constants.ts (ENRICH_ATTEMPTS=3,
// ENRICH_BACKOFF_DELAY_MS=5000).
// ============================================================

const IMAGE_BANK_JOB_OPTIONS = {
  ...defaultJobOptions,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
};

export const imageBankEnrichQueue: Queue<ImageBankEnrichJobData, void, string> | null = connection
  ? new Queue<ImageBankEnrichJobData, void, string>("image-bank-enrich", {
      connection,
      defaultJobOptions: IMAGE_BANK_JOB_OPTIONS,
    })
  : null;

export const imageBankImportQueue: Queue<ImageBankImportJobData, void, string> | null = connection
  ? new Queue<ImageBankImportJobData, void, string>("image-bank-import", {
      connection,
      defaultJobOptions: { ...IMAGE_BANK_JOB_OPTIONS, attempts: 2 },
    })
  : null;

export const imageBankAutoConvertQueue: Queue<
  ImageBankAutoConvertJobData,
  { lqipBase64: string; slug: string },
  string
> | null = connection
  ? new Queue<ImageBankAutoConvertJobData, { lqipBase64: string; slug: string }, string>(
      AUTO_CONVERT_QUEUE_NAME,
      { connection, defaultJobOptions: { ...IMAGE_BANK_JOB_OPTIONS, attempts: 3 } },
    )
  : null;

export const imageBankTranslateQueue: Queue<ImageBankTranslateJobData, void, string> | null =
  connection
    ? new Queue<ImageBankTranslateJobData, void, string>("image-bank-translate", {
        connection,
        defaultJobOptions: IMAGE_BANK_JOB_OPTIONS,
      })
    : null;

export const imageBankCronsQueue: Queue<ImageBankCronJobData, void, ImageBankCronJobType> | null =
  connection
    ? new Queue<ImageBankCronJobData, void, ImageBankCronJobType>("image-bank-crons", {
        connection,
        defaultJobOptions: { ...IMAGE_BANK_JOB_OPTIONS, attempts: 1 },
      })
    : null;

// ============================================================
// Helpers d'enqueue typés (utilises par Server Actions)
// ============================================================

/**
 * Image Bank V1 — enqueue helpers (Server Actions / workers internal).
 *
 * No-op proprement si BullMQ désactivé ou pas de connection Redis (build
 * GH Actions avec REDIS_URL=stub.invalid). Pattern aligné sur `enqueueEmail`.
 */
export async function enqueueImageBankEnrich(data: ImageBankEnrichJobData): Promise<void> {
  if (!imageBankEnrichQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(`[bullmq] no connection, skipping enqueueImageBankEnrich(${data.imageId})`);
    }
    return;
  }
  await imageBankEnrichQueue.add(`enrich-${data.imageId}`, data);
}

export async function enqueueImageBankImport(data: ImageBankImportJobData): Promise<void> {
  if (!imageBankImportQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueImageBankImport(${data.originalFilename})`,
      );
    }
    return;
  }
  await imageBankImportQueue.add(`import-${data.batchId ?? "single"}-${Date.now()}`, data);
}

export async function enqueueImageBankTranslate(data: ImageBankTranslateJobData): Promise<void> {
  if (!imageBankTranslateQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueImageBankTranslate(${data.imageId} ${data.sourceLang}→${data.targetLang})`,
      );
    }
    return;
  }
  await imageBankTranslateQueue.add(
    `translate-${data.imageId}-${data.sourceLang}-${data.targetLang}`,
    data,
  );
}

export async function enqueueImageBankAutoConvert(
  data: ImageBankAutoConvertJobData,
): Promise<void> {
  if (!imageBankAutoConvertQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueImageBankAutoConvert(${data.targetSlug})`,
      );
    }
    return;
  }
  await imageBankAutoConvertQueue.add(`convert-${data.targetSlug}`, data, {
    jobId: data.targetSlug,
  });
}

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

  // Sprint 10 V2 — tier-lifecycle daily (06:00 UTC).
  // Audit indexation 2026-05-18 — pattern mensuel → daily pour scale
  // 500 articles/jour. removeRepeatable des 2 patterns idempotence migration.
  if (contentTierLifecycleQueue) {
    await contentTierLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 15 * *" },
      "content-tier-lifecycle-cron",
    );
    await contentTierLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 * * *" },
      "content-tier-lifecycle-cron",
    );
    await contentTierLifecycleQueue.add(
      "tick",
      { trigger: "cron-daily-0600", tick: new Date().toISOString() },
      { repeat: { pattern: "0 6 * * *" }, jobId: "content-tier-lifecycle-cron" },
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

  // Audit final fix P0-3 — Web Vitals monitor daily 02:30 UTC.
  if (contentWebVitalsMonitorQueue) {
    await contentWebVitalsMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "30 2 * * *" },
      "content-web-vitals-monitor-cron",
    );
    await contentWebVitalsMonitorQueue.add(
      "tick",
      { trigger: "cron-daily-0230", tick: new Date().toISOString() },
      { repeat: { pattern: "30 2 * * *" }, jobId: "content-web-vitals-monitor-cron" },
    );
  }

  // P2-29 (audit re-run 2026-05-15) — PSI monitor weekly Monday 03:00 UTC.
  if (contentPsiMonitorQueue) {
    await contentPsiMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "0 3 * * 1" },
      "content-psi-monitor-cron",
    );
    await contentPsiMonitorQueue.add(
      "tick",
      { trigger: "cron-weekly-mon-0300", tick: new Date().toISOString() },
      { repeat: { pattern: "0 3 * * 1" }, jobId: "content-psi-monitor-cron" },
    );
  }

  // Méta-cert 2026-05-15 AGENT 19 — content-monitoring hourly @ xx:15.
  // Câble alertQueueStuck + alertSoft404Detected + alertIndexationStagnant.
  if (contentMonitoringQueue) {
    await contentMonitoringQueue.removeRepeatable(
      "tick",
      { pattern: "15 * * * *" },
      "content-monitoring-cron",
    );
    await contentMonitoringQueue.add(
      "tick",
      { trigger: "cron-hourly-xx15", tick: new Date().toISOString() },
      { repeat: { pattern: "15 * * * *" }, jobId: "content-monitoring-cron" },
    );
  }

  // Sprint A 2026-05-21 D-P5-3 — rapport qualité hebdomadaire lundi 7h00 UTC (≈ 8h CET).
  if (contentWeeklyReportQueue) {
    await contentWeeklyReportQueue.removeRepeatable(
      "tick",
      { pattern: "0 7 * * 1" },
      "content-weekly-report-cron",
    );
    await contentWeeklyReportQueue.add(
      "tick",
      { trigger: "cron-weekly-mon-0700", tick: new Date().toISOString() },
      { repeat: { pattern: "0 7 * * 1" }, jobId: "content-weekly-report-cron" },
    );
  }

  // Sprint Campaign Controls C.2 — scheduler worker toutes les 5 min.
  if (contentSchedulerQueue) {
    await contentSchedulerQueue.removeRepeatable(
      "tick",
      { pattern: "*/5 * * * *" },
      "content-gen-scheduler-cron",
    );
    await contentSchedulerQueue.add(
      "tick",
      { trigger: "cron-5min", tick: new Date().toISOString() },
      { repeat: { pattern: "*/5 * * * *" }, jobId: "content-gen-scheduler-cron" },
    );
  }

  // Sprint Campaign Controls C.3 — deadline checker daily 00:05 UTC.
  if (contentDeadlineCheckerQueue) {
    await contentDeadlineCheckerQueue.removeRepeatable(
      "tick",
      { pattern: "5 0 * * *" },
      "content-gen-deadline-checker-cron",
    );
    await contentDeadlineCheckerQueue.add(
      "tick",
      { trigger: "cron-daily-0005", tick: new Date().toISOString() },
      { repeat: { pattern: "5 0 * * *" }, jobId: "content-gen-deadline-checker-cron" },
    );
  }

  // Phase F Sprint Perfection 2026 — embeddings backfill daily 03:00 UTC.
  // Gate : OPENAI_EMBEDDINGS_ENABLED=true (le worker gère le skip silencieux si false).
  if (embeddingsBackfillQueue) {
    await embeddingsBackfillQueue.removeRepeatable(
      "tick",
      { pattern: "0 3 * * *" },
      "embeddings-backfill-cron",
    );
    await embeddingsBackfillQueue.add(
      "tick",
      { trigger: "cron-daily-0300", tick: new Date().toISOString() },
      { repeat: { pattern: "0 3 * * *" }, jobId: "embeddings-backfill-cron" },
    );
  }

  // Sprint H 2026-05-22 — Brand Voice Drift Monitor daily 04:00 UTC.
  if (brandVoiceDriftMonitorQueue) {
    await brandVoiceDriftMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "0 4 * * *" },
      "brand-voice-drift-monitor-cron",
    );
    await brandVoiceDriftMonitorQueue.add(
      "tick",
      { trigger: "cron-daily-0400", tick: new Date().toISOString() },
      { repeat: { pattern: "0 4 * * *" }, jobId: "brand-voice-drift-monitor-cron" },
    );
  }

  // Phase 8 Keywords Perfection 2026-05-22 — Keyword opportunity detector (lundi 06:00 UTC)
  if (keywordOpportunityDetectorQueue) {
    await keywordOpportunityDetectorQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 * * 1" },
      "keyword-opportunity-detector-cron",
    );
    await keywordOpportunityDetectorQueue.add(
      "tick",
      { trigger: "cron-weekly-monday-0600", tick: new Date().toISOString() },
      { repeat: { pattern: "0 6 * * 1" }, jobId: "keyword-opportunity-detector-cron" },
    );
  }

  // Sprint Final 2026-05-22 — Reset cost counters monthly (1er du mois 00:00 UTC).
  // Sans ce cron, kill-switch global content-gen se déclenche après le 1er mois.
  if (costCapResetQueue) {
    await costCapResetQueue.removeRepeatable(
      "tick",
      { pattern: "0 0 1 * *" },
      "cost-cap-reset-cron",
    );
    await costCapResetQueue.add(
      "tick",
      { trigger: "cron-monthly-1st-0000", tick: new Date().toISOString() },
      { repeat: { pattern: "0 0 1 * *" }, jobId: "cost-cap-reset-cron" },
    );
  }

  // Sprint Final 2026-05-22 — External links monthly HEAD check (1er du mois 02:00 UTC).
  // Gate EXTERNAL_LINKS_MONITOR_ENABLED=true côté worker (no-op sinon).
  if (externalLinksMonitorQueue) {
    await externalLinksMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "0 2 1 * *" },
      "external-links-monitor-cron",
    );
    await externalLinksMonitorQueue.add(
      "tick",
      { trigger: "cron-monthly-1st-0200", tick: new Date().toISOString() },
      { repeat: { pattern: "0 2 1 * *" }, jobId: "external-links-monitor-cron" },
    );
  }

  // Sprint Site Explorer Admin 2026-05-22 — inspection URLs publiques daily 02:00 UTC.
  if (siteRouteInspectorQueue) {
    await siteRouteInspectorQueue.removeRepeatable(
      "tick",
      { pattern: "0 2 * * *" },
      "site-route-inspector-cron",
    );
    await siteRouteInspectorQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 2 * * *" }, jobId: "site-route-inspector-cron" },
    );
  }

  // Sprint Site Explorer Admin 2026-05-22 — détection anomalies daily 03:00 UTC.
  if (siteRouteAnomalyDetectorQueue) {
    await siteRouteAnomalyDetectorQueue.removeRepeatable(
      "tick",
      { pattern: "0 3 * * *" },
      "site-route-anomaly-detector-cron",
    );
    await siteRouteAnomalyDetectorQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 3 * * *" }, jobId: "site-route-anomaly-detector-cron" },
    );
  }
}
