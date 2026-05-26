// Hub notifications — types (Sprint Notif Infra 2026-05-26 / ADR 0027).
//
// Discriminated union strict sur `category` : TypeScript force la bonne forme
// du `payload` pour chaque catégorie. Plus jamais de magic string.
//
// Cf. `src/server/notifications/index.ts` pour l'API publique `notify(event)`.

export type NotificationSeverity = "info" | "warn" | "error" | "critical";

export type NotificationChannel = "telegram" | "email" | "sentry";

export type NotificationEvent =
  // === Formulaires publics ===
  | {
      category: "CONTACT_FORM_SUBMITTED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        formType: string;
        ville?: string;
        companyName?: string;
        companySize?: string;
        budgetIndicative?: string;
        timingWeeks?: string;
        subType?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "AUDIT_REQUEST_SUBMITTED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        ville?: string;
        companyName?: string;
        companySize?: string;
        subType?: string;
        budgetIndicative?: string;
        timingWeeks?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "INTERVENTION_REQUEST_SUBMITTED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        ville?: string;
        companyName?: string;
        subType?: string;
        urgency?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "IMPLEMENTATION_REQUEST_SUBMITTED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        ville?: string;
        companyName?: string;
        scope?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "QUOTE_REQUEST_RECEIVED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        ville?: string;
        companyName?: string;
        budget?: string;
        timingWeeks?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  // === Newsletter ===
  | {
      category: "NEWSLETTER_PENDING" | "NEWSLETTER_CONFIRMED" | "NEWSLETTER_UNSUBSCRIBED";
      payload: { email: string; locale?: "fr" | "en" };
    }
  // === Booking interne (existant) ===
  | {
      category: "BOOKING_CREATED";
      payload: {
        bookingId: string;
        contactName?: string;
        contactEmail?: string;
        serviceType: string;
        bookingDate?: string;
      };
    }
  | {
      category: "BOOKING_CANCELLED";
      payload: { bookingId: string; reason?: string; cancelledBy?: string };
    }
  | {
      category: "OPTION_POSTED";
      payload: { bookingId: string; expiresAt?: string };
    }
  | {
      category: "OPTION_CONFIRMED";
      payload: { bookingId: string; admin?: string };
    }
  | {
      category: "OPTION_REFUSED";
      payload: { bookingId: string; admin?: string; reason?: string };
    }
  | {
      category: "OPTION_EXPIRED";
      payload: { bookingId: string };
    }
  // === Calendly (Chantier 3) ===
  | {
      category: "CALENDLY_INVITEE_CREATED";
      payload: {
        eventUri: string;
        inviteeEmail: string;
        inviteeName: string;
        eventStartTime: string;
        eventName: string;
        pageUrl?: string;
        utmSource?: string;
        utmCampaign?: string;
      };
    }
  | {
      category: "CALENDLY_INVITEE_CANCELED";
      payload: { eventUri: string; inviteeEmail: string; reason?: string };
    }
  | {
      category: "CALENDLY_INVITEE_RESCHEDULED";
      payload: { eventUri: string; inviteeEmail: string; oldStart: string; newStart: string };
    }
  // === Reply admin (Chantier 5) ===
  | {
      category: "ADMIN_REPLIED_TO_SUBMISSION";
      payload: {
        submissionId: string;
        replyId: string;
        repliedBy: string;
        toEmail: string;
        subject: string;
      };
    }
  // === Ops / infra ===
  | {
      category: "DEPLOY_SUCCESS" | "DEPLOY_FAILED";
      payload: { sha: string; duration?: number; error?: string };
    }
  | {
      category: "BACKUP_SUCCESS" | "BACKUP_FAILED";
      payload: { type: string; size?: number; error?: string };
    }
  | {
      category: "INCIDENT_DETECTED";
      payload: {
        title: string;
        url?: string;
        statusCode?: number;
        error?: string;
        userId?: string;
      };
    }
  | {
      category: "SECURITY_ALERT";
      payload: { kind: string; ip?: string; details: Record<string, unknown> };
    }
  | {
      category: "STRIPE_EVENT";
      payload: { eventType: string; objectId?: string; amount?: number };
    }
  | {
      category: "STRIPE_WEBHOOK_SIGNATURE_FAIL";
      payload: { ip?: string };
    }
  | {
      category: "MONITORING_ALERT";
      payload: { kind: string; details: Record<string, unknown> };
    };

export type NotificationCategory = NotificationEvent["category"];

/** Argument complet passé à `notify()`. */
export type NotifyInput<C extends NotificationCategory = NotificationCategory> = Extract<
  NotificationEvent,
  { category: C }
> & {
  /** Override severity (sinon utilise la valeur du routing par défaut). */
  severity?: NotificationSeverity;
  /** Override channels (sinon utilise le routing par défaut). */
  channels?: NotificationChannel[];
  /** Clé de déduplication Redis. Empêche un doublon dans le TTL. */
  dedupKey?: string;
  /** TTL dedup en secondes (défaut 300). */
  dedupTtlSec?: number;
  /** Bypass le rate-limit par catégorie. */
  force?: boolean;
  /** Forcer le mode synchrone (sinon dispatch selon severity). */
  sync?: boolean;
};

/** Résultat de `notify()` — soft-fail, jamais de throw. */
export interface NotifyResult {
  ok: boolean;
  deduped?: boolean;
  rateLimited?: boolean;
  channels: Partial<Record<NotificationChannel, "sent" | "queued" | "skipped" | "failed">>;
}
