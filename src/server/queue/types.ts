// BullMQ job types (Sprint 15 / M8 step 4).
//
// Une seule queue `emails` pour tous les envois transactionnels.
// 2 queues cron dediees pour les jobs récurrents (expiration + rappel option 48h).

import type { Locale } from "../../../prisma/generated/client";

// ============================================================
// Queue: emails
// ============================================================

export type EmailJobName =
  | "booking-confirmed"
  | "booking-cancelled"
  | "option-posted"
  | "option-reminder"
  | "option-expired"
  | "option-confirmed-by-admin"
  | "option-refused-by-admin"
  | "audit-confirmed"
  | "implementation-confirmed"
  | "newsletter-confirm-optin"
  | "contact-confirmed"
  | "gdpr-export-link";

export interface EmailJobData {
  template: EmailJobName;
  to: string;
  locale: Locale;
  /** Donnees pour interpolation du template (typage runtime — chaque template
   *  parse avec Zod en entree). */
  payload: Record<string, unknown>;
  /** Marketing vs transactionnel (CLAUDE.md §11 — distingue noreply@ vs news@). */
  marketing?: boolean;
}

// ============================================================
// Queue: option-expiration (cron 5 min)
// ============================================================

export interface OptionExpirationJobData {
  /** Tick — utilise pour traceabilite, pas critique. */
  tick: string;
}

// ============================================================
// Queue: option-reminder (cron 1 h)
// ============================================================

export interface OptionReminderJobData {
  tick: string;
}

// ============================================================
// Queue: newsletter (campagnes — V1 placeholder)
// ============================================================

export interface NewsletterCampaignJobData {
  campaignId: string;
  locale: Locale;
}

// ============================================================
// Queue: search-indexer (V1 placeholder — FTS GENERATED auto)
// ============================================================

export interface SearchIndexerJobData {
  table: "articles" | "help_articles" | "case_studies";
  rowId: string;
}

// ============================================================
// Queue: retention-purge (Sprint 24 / D3 — RGPD daily 03:00)
// ============================================================

export interface RetentionPurgeJobData {
  tick: string;
}
