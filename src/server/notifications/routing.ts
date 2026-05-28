// Hub notifications — routing par catégorie (Sprint Notif Infra 2026-05-26).
//
// Tableau simple `(category) → { channels, severity }`. Modifiable plus tard
// via env var ou table admin sans toucher au code des call-sites.

import type { NotificationCategory, NotificationChannel, NotificationSeverity } from "./types";

interface RoutingEntry {
  channels: NotificationChannel[];
  severity: NotificationSeverity;
  /** Limite de rate (max events / heure). 0 = pas de limite. */
  rateLimitPerHour?: number;
}

const ROUTING: Record<NotificationCategory, RoutingEntry> = {
  // --- Formulaires publics : Telegram + breadcrumb Sentry, sync ---
  CONTACT_FORM_SUBMITTED: { channels: ["telegram"], severity: "info" },
  AUDIT_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  INTERVENTION_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  IMPLEMENTATION_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  QUOTE_REQUEST_RECEIVED: { channels: ["telegram"], severity: "info" },

  // --- Form v2 (2026-05-28) : 5 demandes périphériques. Severity "warn" pour
  // investisseur (signal stratégique fort), "info" pour les 4 autres. ---
  PRESS_REQUEST_SUBMITTED: { channels: ["telegram"], severity: "info" },
  RECRUITMENT_RECEIVED: { channels: ["telegram"], severity: "info" },
  SPEAKER_INVITATION_RECEIVED: { channels: ["telegram"], severity: "info" },
  INVESTOR_INQUIRY_RECEIVED: { channels: ["telegram"], severity: "warn" },
  CUSTOMER_SUPPORT_REQUEST: { channels: ["telegram"], severity: "warn" },

  // --- Newsletter ---
  NEWSLETTER_PENDING: { channels: ["telegram"], severity: "info" },
  NEWSLETTER_CONFIRMED: { channels: ["telegram"], severity: "info" },
  NEWSLETTER_UNSUBSCRIBED: { channels: ["telegram"], severity: "info" },

  // --- Booking interne ---
  BOOKING_CREATED: { channels: ["telegram"], severity: "info" },
  BOOKING_CANCELLED: { channels: ["telegram"], severity: "warn" },
  OPTION_POSTED: { channels: ["telegram"], severity: "info" },
  OPTION_CONFIRMED: { channels: ["telegram"], severity: "info" },
  OPTION_REFUSED: { channels: ["telegram"], severity: "warn" },
  OPTION_EXPIRED: { channels: ["telegram"], severity: "warn" },

  // --- Calendly ---
  CALENDLY_INVITEE_CREATED: { channels: ["telegram"], severity: "info" },
  CALENDLY_INVITEE_CANCELED: { channels: ["telegram"], severity: "warn" },
  CALENDLY_INVITEE_RESCHEDULED: { channels: ["telegram"], severity: "info" },

  // --- Reply admin (Chantier 5) — décision Will figée : pas de notif ---
  ADMIN_REPLIED_TO_SUBMISSION: { channels: [], severity: "info" },

  // --- Ops ---
  DEPLOY_SUCCESS: { channels: ["telegram"], severity: "info" },
  DEPLOY_FAILED: { channels: ["telegram", "sentry"], severity: "error" },
  BACKUP_SUCCESS: { channels: ["telegram"], severity: "info" },
  BACKUP_FAILED: { channels: ["telegram", "sentry"], severity: "critical" },
  INCIDENT_DETECTED: { channels: ["telegram", "sentry"], severity: "error" },
  SECURITY_ALERT: {
    channels: ["telegram", "sentry"],
    severity: "critical",
    rateLimitPerHour: 12,
  },
  STRIPE_EVENT: { channels: ["telegram"], severity: "info" },
  STRIPE_WEBHOOK_SIGNATURE_FAIL: {
    channels: ["telegram", "sentry"],
    severity: "warn",
    rateLimitPerHour: 6,
  },
  MONITORING_ALERT: {
    channels: ["telegram"],
    severity: "warn",
    rateLimitPerHour: 30,
  },
};

export function getRouting(category: NotificationCategory): RoutingEntry {
  return ROUTING[category];
}

/** Décide si on dispatch sync ou async. */
export function shouldDispatchAsync(severity: NotificationSeverity): boolean {
  // Sync pour info/warn (latence acceptable < 200ms côté Server Action).
  // Async via queue pour error/critical (fire-and-forget, retry possible).
  return severity === "error" || severity === "critical";
}
