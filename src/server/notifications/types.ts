// Hub notifications — types (Sprint Notif Infra 2026-05-26 / ADR 0027).
//
// Discriminated union strict sur `category` : TypeScript force la bonne forme
// du `payload` pour chaque catégorie. Plus jamais de magic string.
//
// Cf. `src/server/notifications/index.ts` pour l'API publique `notify(event)`.

export type NotificationSeverity = "info" | "warn" | "error" | "critical";

export type NotificationChannel = "telegram" | "email" | "sentry" | "whatsapp";

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
  // === Demandes périphériques (Form v2 2026-05-28) ===
  // 5 catégories séparées (et non MISC générique) car chacune a une routing
  // différente : presse → comms, recrutement → talents, investisseur → CEO,
  // speaker → comms, support → ops. Distinction fine en Telegram + email
  // dispatch downstream.
  | {
      category: "PRESS_REQUEST_SUBMITTED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        outlet?: string;
        deadline?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "RECRUITMENT_RECEIVED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        position?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "JOB_APPLICATION_RECEIVED";
      payload: {
        applicationId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        offerTitle: string;
        offerCategory?: string;
        city?: string;
        salaryExpectation?: string;
        hasCv: boolean;
        hasPhoto?: boolean;
        locale: "fr" | "en";
      };
    }
  | {
      // Rappel hebdo du cron `formation-crons.offres-fraicheur` : offres
      // d'emploi dont le datePosted (celui que Google for Jobs voit) dépasse le
      // seuil de republication. La republication reste HUMAINE (bouton console) —
      // jamais de bump automatique de date (fausse fraîcheur = spam Google).
      category: "JOB_OFFERS_STALE";
      payload: {
        thresholdDays: number;
        offers: Array<{
          title: string;
          daysOld: number;
          /** "db" = republiable en console ; "statique" = page code (Claude). */
          kind: "db" | "statique";
        }>;
      };
    }
  | {
      category: "REVIEW_SUBMITTED";
      payload: {
        reviewId: string;
        /** Identité publique : prénom + initiale (ex. "Marie D."). */
        authorName: string;
        rating: number;
        companyName?: string;
        clientSector?: string;
        city?: string;
        serviceLine?: string;
        hasPhoto: boolean;
        /** Début du commentaire (aperçu). */
        excerpt?: string;
        locale: "fr" | "en";
      };
    }
  | {
      // Demande de tournage podcast dirigeant (page publique `/podcast`).
      // Offre gratuite, sans lien avec l'achat d'une formation (décision Will
      // 2026-07-21) — c'est un lead d'entrée, pas une commande.
      category: "PODCAST_REQUEST_SUBMITTED";
      payload: {
        requestId: string;
        companyName: string;
        leaderName: string;
        contactEmail: string;
        contactPhone: string;
        /** Ville + code postal : on se déplace, la géo pilote la faisabilité. */
        city: string;
        postalCode: string;
        /** Début de la description d'activité (aperçu). */
        activityExcerpt?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "SPEAKER_INVITATION_RECEIVED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        eventName?: string;
        eventDate?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "INVESTOR_INQUIRY_RECEIVED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        firm?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      category: "CUSTOMER_SUPPORT_REQUEST";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        ville?: string;
        companyName?: string;
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
        /** ISO si connu, sinon texte libre (« (voir mail Calendly) »). */
        eventStartTime: string;
        eventName: string;
        pageUrl?: string;
        utmSource?: string;
        utmCampaign?: string;
        /** Champs enrichis depuis l'API Calendly (2026-08-09). */
        inviteePhone?: string;
        cancelUrl?: string;
      };
    }
  | {
      category: "CALENDLY_INVITEE_CANCELED";
      payload: {
        eventUri: string;
        inviteeEmail: string;
        reason?: string;
        // Ajoutés le 2026-08-09 : une annulation qui ne dit ni QUI ni QUAND
        // oblige à ouvrir la console pour comprendre de quel RDV il s'agit.
        inviteeName?: string;
        eventName?: string;
        eventStartTime?: string;
      };
    }
  | {
      category: "CALENDLY_INVITEE_RESCHEDULED";
      payload: {
        eventUri: string;
        inviteeEmail: string;
        oldStart: string;
        newStart: string;
        inviteeName?: string;
        eventName?: string;
      };
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
      /**
       * Contexte ajouté le 2026-07-29 avec le premier émetteur réel de ces
       * catégories (`api/internal/deploy-notify`, appelé par GitHub Actions).
       * Un SHA seul ne dit pas quoi regarder quand une alerte tombe la nuit :
       * la branche, l'auteur, le sujet du commit et le lien vers le run sont
       * ce qui permet de décider en dix secondes s'il faut se lever.
       */
      payload: {
        sha: string;
        duration?: number;
        error?: string;
        branch?: string;
        actor?: string;
        subject?: string;
        runUrl?: string;
      };
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
