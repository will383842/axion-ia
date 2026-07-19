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
  JOB_APPLICATION_RECEIVED: { channels: ["telegram"], severity: "info" },
  REVIEW_SUBMITTED: { channels: ["telegram"], severity: "info" },
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

// ── Routage Telegram par GROUPE (refonte 2026-07-09) ────────────────────────
// 1 bot @axion_ia_notif_bot → 3 groupes séparés. Chaque catégorie est routée
// vers son groupe ; le chat_id est résolu depuis l'env (fallback rétro-compatible
// sur TELEGRAM_CHAT_ID si un groupe n'est pas encore configuré).

export type TelegramGroup = "rdv" | "messages" | "system";

/** 📅 RDV : réservations / options / Calendly (appels & rendez-vous). */
const RDV_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  "BOOKING_CREATED",
  "BOOKING_CANCELLED",
  "OPTION_POSTED",
  "OPTION_CONFIRMED",
  "OPTION_REFUSED",
  "OPTION_EXPIRED",
  "CALENDLY_INVITEE_CREATED",
  "CALENDLY_INVITEE_CANCELED",
  "CALENDLY_INVITEE_RESCHEDULED",
]);

/** 💬 Messages : tout message entrant d'une personne (formulaires + leads). */
const MESSAGE_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  "CONTACT_FORM_SUBMITTED",
  "AUDIT_REQUEST_SUBMITTED",
  "INTERVENTION_REQUEST_SUBMITTED",
  "IMPLEMENTATION_REQUEST_SUBMITTED",
  "QUOTE_REQUEST_RECEIVED",
  "PRESS_REQUEST_SUBMITTED",
  "RECRUITMENT_RECEIVED",
  "JOB_APPLICATION_RECEIVED",
  "SPEAKER_INVITATION_RECEIVED",
  "INVESTOR_INQUIRY_RECEIVED",
  "CUSTOMER_SUPPORT_REQUEST",
]);

/** Groupe cible d'une catégorie (défaut : 🔔 Système — newsletter, avis, ops…). */
export function telegramGroupFor(category: NotificationCategory): TelegramGroup {
  if (RDV_CATEGORIES.has(category)) return "rdv";
  if (MESSAGE_CATEGORIES.has(category)) return "messages";
  return "system";
}

// ── Canal WhatsApp (CallMeBot) — leads humains uniquement (2026-07-19) ───────
// Décision Will : WhatsApp double le canal Telegram, mais SEULEMENT pour les
// formulaires « une vraie personne qui attend une réponse » (contact, devis/audit,
// réservation/RDV, candidature). Les alertes système/ops/newsletter/avis restent
// Telegram-only pour ne pas polluer le WhatsApp perso.
//
// ⚠️ Le canal reste no-op tant que WHATSAPP_CALLMEBOT_APIKEY + WHATSAPP_NOTIFY_PHONE
// ne sont pas définis (cf. `channels/whatsapp.ts`) — cette liste ne fait qu'AUTORISER
// le doublon, elle ne déclenche rien seule.
//
// Pour ajouter une catégorie sur WhatsApp (ex. presse / investisseur) : ajoute
// simplement sa clé ici. Pour la retirer : enlève la ligne. Rien d'autre à toucher.
const WHATSAPP_LEAD_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  // Contact & demandes commerciales (devis / audit / intervention / implémentation)
  "CONTACT_FORM_SUBMITTED",
  "AUDIT_REQUEST_SUBMITTED",
  "INTERVENTION_REQUEST_SUBMITTED",
  "IMPLEMENTATION_REQUEST_SUBMITTED",
  "QUOTE_REQUEST_RECEIVED",
  "CUSTOMER_SUPPORT_REQUEST",
  // Candidatures
  "JOB_APPLICATION_RECEIVED",
  "RECRUITMENT_RECEIVED",
  // Réservations / RDV (création d'intention)
  "BOOKING_CREATED",
  "OPTION_POSTED",
  "CALENDLY_INVITEE_CREATED",
]);

/** Vrai si la catégorie doit AUSSI notifier WhatsApp (leads humains). */
export function shouldNotifyWhatsApp(category: NotificationCategory): boolean {
  return WHATSAPP_LEAD_CATEGORIES.has(category);
}

/**
 * Résout le chat_id Telegram d'un groupe depuis l'env. Fallback rétro-compatible
 * sur `TELEGRAM_CHAT_ID` (comportement legacy 1-groupe) si le groupe n'a pas de
 * chat_id dédié configuré.
 */
export function resolveTelegramChatId(group: TelegramGroup): string | undefined {
  const byGroup =
    group === "rdv"
      ? process.env.TELEGRAM_CHAT_ID_RDV
      : group === "messages"
        ? process.env.TELEGRAM_CHAT_ID_MESSAGES
        : process.env.TELEGRAM_CHAT_ID_SYSTEM;
  return byGroup || process.env.TELEGRAM_CHAT_ID;
}
