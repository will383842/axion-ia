// BullMQ queue producers (Sprint 15 / M8 step 4).
//
// Pattern : on declare les queues une seule fois, on les exporte pour que
// les Server Actions puissent enqueue sans toucher a BullMQ directement.

import { Queue } from "bullmq";
import { getBullConnection } from "./connection";
import type {
  EmailJobData,
  EmailJobName,
  OptionExpirationJobData,
  OptionReminderJobData,
  NewsletterCampaignJobData,
  SearchIndexerJobData,
} from "./types";

const connection = getBullConnection();

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
};

export const emailsQueue = new Queue<EmailJobData, void, EmailJobName>("emails", {
  connection,
  defaultJobOptions,
});

export const optionExpirationQueue = new Queue<OptionExpirationJobData>("option-expiration", {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
});

export const optionReminderQueue = new Queue<OptionReminderJobData>("option-reminder", {
  connection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
});

export const newsletterQueue = new Queue<NewsletterCampaignJobData>("newsletter", {
  connection,
  defaultJobOptions,
});

export const searchIndexerQueue = new Queue<SearchIndexerJobData>("search-indexer", {
  connection,
  defaultJobOptions,
});

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
  const data: EmailJobData = options?.marketing
    ? { template, to, locale, payload, marketing: true }
    : { template, to, locale, payload };
  const addOptions = options?.delayMs ? { delay: options.delayMs } : undefined;
  await emailsQueue.add(template, data, addOptions);
}

/**
 * Boot des cron jobs recurrents — appele une seule fois au demarrage du
 * worker (`pnpm worker`). Utilise des repeatable jobs BullMQ (idempotents).
 */
export async function bootRepeatableJobs(): Promise<void> {
  // Cron 5min : libere les options 48h expirees
  await optionExpirationQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { repeat: { pattern: "*/5 * * * *" }, jobId: "option-expiration-cron" },
  );

  // Cron 1h : envoie rappel H+24
  await optionReminderQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { repeat: { pattern: "0 * * * *" }, jobId: "option-reminder-cron" },
  );
}
