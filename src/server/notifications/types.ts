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
        message?: string;
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
        message?: string;
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
        message?: string;
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
        message?: string;
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
        message?: string;
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
        message?: string;
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
        message?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      // `VIDEO_EDITOR_APPLICATION_RECEIVED` = même payload, mais catégorie SÉPARÉE
      // (demande Will 2026-08-12) : les candidatures à l'offre monteur vidéo
      // freelance ont leur propre groupe Telegram + doublon WhatsApp, pour ne pas
      // être mélangées aux autres candidatures. Le choix de catégorie se fait au
      // call-site sur le slug de l'offre (cf. `videoEditorNotificationCategory`).
      category: "JOB_APPLICATION_RECEIVED" | "VIDEO_EDITOR_APPLICATION_RECEIVED";
      payload: {
        applicationId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        offerTitle: string;
        offerCategory?: string;
        city?: string;
        salaryExpectation?: string;
        /** Début du texte de motivation (tronqué côté émetteur). */
        motivationExcerpt?: string;
        hasCv: boolean;
        hasPhoto?: boolean;
        locale: "fr" | "en";
      };
    }
  | {
      // Candidature commerciale — tunnel sans CV `/devenir-commercial-ia/candidature`
      // (annonce presse Mémorial de l'Isère, 2026-08-12). Catégorie SÉPARÉE des
      // autres candidatures : salon Telegram dédié 🧲 + doublon WhatsApp, comme
      // le monteur vidéo. Message volontairement COURT : les 6 champs qui
      // permettent de juger depuis le téléphone, le reste vit en console.
      category: "COMMERCIAL_APPLICATION_RECEIVED";
      payload: {
        submissionId: string;
        contactName: string;
        contactEmail: string;
        contactPhone?: string;
        ville?: string;
        /** Zone souhaitée (labels lisibles) ou « Mobile — peu importe ». */
        zone?: string;
        /** Années d'expérience B2B (« 3-5 ans ») ou « aucune ». */
        b2bYears?: string;
        /** Disponibilité annoncée (« septembre 2026 »). */
        availability?: string;
        /** Utilise déjà l'IA au quotidien. */
        usesAi: boolean;
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
        message?: string;
        source?: string;
        locale: "fr" | "en";
      };
    }
  | {
      // Demande RGPD déposée depuis le portail stagiaire (2026-08-13).
      //
      // 🔴 Sévérité `warn`, et ce n'est pas de la prudence : le délai de
      // réponse est d'UN MOIS et il court dès le dépôt. Avant cette
      // catégorie, la demande n'était signalée à PERSONNE — elle pouvait
      // dormir jusqu'à ce que la personne saisisse la CNIL.
      category: "RGPD_REQUEST_SUBMITTED";
      payload: {
        demandeId: string;
        /** `export` (art. 15) ou `suppression` (art. 17). */
        type: string;
        traineeNom: string;
        traineeEmail: string;
        /** Échéance légale, déjà formatée. */
        echeance: string;
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
        message?: string;
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
        message?: string;
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
        message?: string;
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
        /** Réponses libres du formulaire Calendly (hors téléphone), « Q : R » concaténées. */
        answersText?: string;
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
    }
  // === Synchro CRM (lot L5) ===
  //
  // Une seule catégorie pour les QUATRE anomalies de la synchro, et pas une par
  // anomalie : c'est `kind` qui distingue, ce qui permet de router, de dédupliquer
  // et de couper les quatre d'un seul geste. L'anti-bruit vit au call-site
  // (`crm-sync/alerts.ts`) sous forme de clé de dédup HORAIRE par `kind` — une
  // synchro en panne produit une alerte par heure, pas une par ligne.
  | {
      category: "CRM_SYNC_ALERT";
      payload: {
        kind: CrmSyncAlertKind;
        /** Volume concerné (backlog, nombre de sources sans ligne d'outbox…). */
        count?: number;
        /** Message d'erreur ou précision libre. */
        detail?: string;
        /** Référence de l'enregistrement source, pour un abandon unitaire. */
        subjectRef?: string;
      };
    };

/**
 * Les quatre anomalies que la synchro sait signaler.
 *
 *  · `gave_up`          — une ligne d'outbox est DÉFINITIVEMENT abandonnée
 *                         (refus 422 du CRM ou plafond de tentatives). C'est un
 *                         lead qui n'arrivera jamais sans intervention humaine.
 *  · `backlog`          — la file dépasse le seuil ferme du plan (50).
 *  · `reconcile_gap`    — le batch quotidien a trouvé des enregistrements
 *                         SOURCE sans ligne d'outbox (la fenêtre post-commit).
 *  · `reconcile_failed` — le batch lui-même a échoué. Sans cette alerte, la
 *                         garantie quotidienne s'éteindrait en silence.
 */
export type CrmSyncAlertKind = "gave_up" | "backlog" | "reconcile_gap" | "reconcile_failed";

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
