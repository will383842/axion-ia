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
}
