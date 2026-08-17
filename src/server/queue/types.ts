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
  // Simulateur de gains v2 — envoi du rapport au dirigeant qui le demande.
  | "roi-report"
  | "gdpr-export-link"
  // RGPD (2026-08-13). Deux manques criants comblés : une demande déposée
  // depuis le portail ne déclenchait AUCUN accusé — et l'effacement art. 17
  // n'envoyait aucune preuve d'exécution, alors que l'adresse est anonymisée
  // juste après, ce qui rendait l'omission irrattrapable.
  | "rgpd-demande-recue"
  | "rgpd-effacement-confirme"
  // Accusés commerciaux ajoutés le 2026-08-13 : ces trois canaux ne
  // répondaient RIEN à l'expéditeur. Gabarits dédiés et non
  // `contact-confirmed`, qui sert déjà à huit flux différents.
  | "podcast-demande-recue"
  | "rappel-confirme"
  | "chatbot-demande-transmise"
  // Remplacent `contact-confirmed` sur deux flux ou il disait FAUX :
  // il promettait une reponse « sous 48 heures ouvrees » a un candidat
  // (un recrutement ne se traite pas en deux jours) et annoncait un
  // rappel a quelqu'un qui venait simplement de laisser un avis.
  | "candidature-recue"
  | "avis-recu"
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
  | "quote-expired"
  // Sprint Notif Infra 2026-05-26 / Chantier 5 — reply admin
  | "submission-reply"
  // T15 — emails auto Qualiopi lifecycle stagiaires + alertes internes
  | "qualiopi-convocation"
  | "qualiopi-rappel-j7"
  | "qualiopi-satisfaction-j1"
  | "qualiopi-suivi-j30"
  // Positionnement (ind. 8) — AVANT la formation. Distinct de l'accès portail :
  // celui-ci demandait qu'on l'ignore, cf. `qualiopi-positionnement.tsx`.
  | "qualiopi-positionnement"
  // Relance de questionnaire sans réponse (J+3 / J+10) + enquête ENTREPRISE.
  | "qualiopi-questionnaire-relance"
  | "qualiopi-enquete-entreprise"
  // Lien PERSONNEL de signature de la feuille de présence. 🔴 Il n'existait
  // pas : `emettreLiensSessionAction` fabriquait les jetons et les affichait à
  // l'écran, sans jamais rien envoyer. La chaîne probante des indicateurs 9 et
  // 11 reposait sur un envoi que personne n'avait écrit.
  | "qualiopi-emargement-lien"
  | "qualiopi-attestation-disponible"
  | "qualiopi-relance-impayee"
  | "qualiopi-portail-acces"
  | "qualiopi-alerte-interne"
  // Documents interventions — notification de nouvelle version publiée
  | "documents-nouvelle-version"
  // Espace formateur — lien de connexion passwordless (magic-link)
  | "formateur-magic-link"
  // Espace ressources — lien de connexion passwordless (commercial/formateur)
  | "ressources-magic-link"
  // Hub facturation — envois MANUELS (admin) de devis/facture avec PDF joint
  | "devis-envoi"
  | "facture-envoi"
  // Convention de formation — envoi MANUEL du lien de signature au client.
  // Sans lui, l'admin copiait l'URL brute du lien dans sa messagerie.
  | "convention-envoi"
  // Candidature commerciale (tunnel sans CV, Mémorial de l'Isère 2026-08-12) :
  // accusé chaleureux au candidat + récapitulatif complet à l'équipe interne.
  | "candidature-commercial-confirmee"
  | "candidature-commercial-recap"
  // Lot L4 2026-08-14 — information RGPD au stock de candidatures avant
  // intégration au vivier (lien d'opposition, fenêtre de 30 jours).
  | "vivier-information";

/**
 * Lot L4 — passage quotidien du vivier candidats.
 *
 * ⚠️ Ces types vivent ICI, et non dans le worker, CONTRAIREMENT au motif des
 * autres files. Raison mesurée : `queues.ts` est importé par toute Server
 * Action qui enfile quoi que ce soit ; s'il pointait vers le worker (même en
 * `import type`), l'outil de test résout quand même le module et tire derrière
 * lui `server/vivier/stock` → `crm-sync` → `queues` — un CYCLE, et ~2 s de
 * chargement supplémentaires. Ce coût a fait DÉPASSER le budget de 5 s d'un
 * test sans rapport (`api/calendly/client-event`), qui passait avant.
 * Déclarer les types dans ce module partagé supprime l'arête, donc le cycle.
 */
export type VivierCronJobType = "integrate-stock";

export interface VivierCronJobData {
  readonly type?: VivierCronJobType;
  readonly tick?: string;
}

export interface EmailJobData {
  template: EmailJobName;
  to: string;
  locale: Locale;
  /** Donnees pour interpolation du template (typage runtime — chaque template
   *  parse avec Zod en entree). */
  payload: Record<string, unknown>;
  /** Marketing vs transactionnel (CLAUDE.md §11 — distingue noreply@ vs news@). */
  marketing?: boolean;
  /** Entité liée (traçabilité EmailLog) — ex. AlerteSysteme/alerteId. */
  entityType?: string;
  entityId?: string;
  /**
   * Pièces jointes (Hub facturation — envoi manuel devis/facture). JAMAIS de
   * binaire dans Redis : uniquement la clé R2 ; le worker télécharge puis
   * attache (fail-soft : envoi sans PJ si R2 indisponible).
   */
  attachments?: Array<{ filename: string; r2Key: string; contentType?: string }>;
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

// ============================================================
// Queue: booking-crons (Sprint X.12 — Booking V1)
// ============================================================
//
// Une queue unique qui dispatche vers des handlers spécialisés selon
// le `type` du job. Permet de mutualiser la connection Redis + le worker.

export type BookingCronJobType =
  /** Daily 09:00 — relances paiement J+1/J+15/J+30 sur invoices issued/partially_paid en retard. */
  | "payment-overdue-scan"
  /** Daily 09:00 — find bookings J-7 → invoice solde + email payment-reminder-j7. */
  | "booking-j7-reminder"
  /** Daily 09:00 — find bookings J-1 confirmed → email booking-j1-reminder. */
  | "booking-j1-reminder"
  /** Daily 09:00 — find cadrageMeetings J-1 → email cadrage-j1-reminder. */
  | "cadrage-j1-reminder"
  /** Hourly — find cadrageMeetings dans [now+2h, now+3h] → email cadrage-h2-reminder. */
  | "cadrage-h2-reminder"
  /** Daily 09:00 — contracts sent depuis >3j sans signature → email contract-reminder. */
  | "contract-pending-reminder"
  /** Daily 09:00 — quotes sent depuis >3j sans réponse → email quote-reminder. */
  | "quote-pending-reminder"
  /** Daily 09:00 — quotes validUntil dépassé → markQuoteDeclined + email quote-expired. */
  | "quote-expiration-check"
  /** Daily 09:00 — contract_payment_sent depuis 10j+ sans acompte → cancel (D52). */
  | "contract-signed-without-deposit-cutoff"
  /** Daily 09:00 — bookings paused dont pausedUntil approche → telegram Will (D61). */
  | "booking-paused-resume-reminder"
  /** Daily 09:00 — sweep bookings completed > 0h pour envoyer thanks. */
  | "booking-completed-thanks-sweep";

export interface BookingCronJobData {
  type: BookingCronJobType;
  tick: string;
}

// ============================================================
// Queue: site-route-inspector (Sprint Site Explorer 2026-05-22 — daily 02:00)
// ============================================================

export interface SiteRouteInspectorJobData {
  tick: string;
  /** Si présent, inspecte uniquement cette route (trigger manuel). */
  siteRouteId?: string;
}

// ============================================================
// Queue: site-route-anomaly-detector (Sprint Site Explorer 2026-05-22 — daily 03:00)
// ============================================================

export interface SiteRouteAnomalyDetectorJobData {
  tick: string;
}

// ============================================================
// Queue: site-route-discovery (Onglet « Toutes les URLs » 2026-06-08 — daily 01:00)
// Énumération unifiée + recalcul indexabilité live. Rend le catalogue « vivant ».
// ============================================================

export interface SiteRouteDiscoveryJobData {
  tick: string;
}

// ============================================================
// Queue: site-route-gsc (Onglet « Toutes les URLs » 2026-06-08 — daily 04:00)
// Tire le trafic réel (clics/impressions/position) par URL depuis Search Console.
// ============================================================

export interface SiteRouteGscJobData {
  tick: string;
}
