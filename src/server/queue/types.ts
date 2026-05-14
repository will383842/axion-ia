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
  | "gdpr-export-link"
  // Sprint X.5bis — parcours B (formulaire devis qualifié)
  | "quote-request-received"
  // Sprint X.13 (Booking V1) — paiements Stripe Checkout
  | "payment-link"
  | "payment-receipt"
  | "payment-failed"
  // Sprint X.13 — clic Will 2 (X.4 validateBookingOnCalendarAction)
  | "booking-validated-on-calendar"
  // Sprint X.13 — D61 pause/reprise
  | "booking-paused-confirmation"
  | "booking-resumed-notification"
  // Sprint X.13 — A23 force majeure
  | "force-majeure-notice"
  // Sprint X.6 — cadrage manual_external
  | "cadrage-scheduled"
  | "cadrage-declined"
  // Sprint X.7 — devis semi-auto
  | "quote-sent"
  | "quote-signed"
  | "quote-declined"
  // Sprint X.15 — self-service client (magic-link)
  | "cancellation-confirmed-by-user"
  | "refund-issued"
  // Sprint X.3 — versioning contrat D62
  | "contract-version-updated"
  // Sprint X.3 / X.13 — workflow contrat
  | "contract-sent"
  | "contract-signed"
  | "contract-refused"
  | "contract-reminder"
  // Sprint X.13 — relances paiement
  | "payment-reminder-j7"
  | "payment-overdue-j1"
  | "payment-overdue-j15"
  | "payment-overdue-j30"
  // Sprint X.13 — cadrage reminders
  | "cadrage-j1-reminder"
  | "cadrage-h2-reminder"
  // Sprint X.13 — booking lifecycle
  | "booking-rescheduled-by-admin"
  | "booking-j1-reminder"
  | "booking-completed-thanks"
  // Sprint X.13 — installments overdue (D59)
  | "installment-overdue-soft"
  | "installment-overdue-firm"
  | "disputed-notice"
  // Sprint X.13 — quote lifecycle
  | "quote-reminder"
  | "quote-expired";

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
