// BullMQ queue producers (Sprint 15 / M8 step 4).
//
// Pattern : on declare les queues une seule fois, on les exporte pour que
// les Server Actions puissent enqueue sans toucher a BullMQ directement.
//
// Toggle dev : si `BULLMQ_DISABLED=true`, toutes les queues sont `null` et
// les helpers `enqueueEmail` / `bootRepeatableJobs` no-op proprement.

import { Queue } from "bullmq";
import { getBullConnection, isBullmqDisabled } from "./connection";
import { resoudreMode, garerPourValidation } from "@/server/email/outbox-service";
import { journaliserEnAttente } from "@/server/email/email-log";
import type {
  EmailJobData,
  EmailJobName,
  OptionExpirationJobData,
  OptionReminderJobData,
  SearchIndexerJobData,
  RetentionPurgeJobData,
  BookingCronJobData,
  BookingCronJobType,
  SiteRouteInspectorJobData,
  SiteRouteAnomalyDetectorJobData,
  SiteRouteDiscoveryJobData,
  SiteRouteGscJobData,
  VivierCronJobData,
  VivierCronJobType,
} from "./types";
import type { ImageBankEnrichJobData } from "./workers/image-bank-enrich-worker";
import type { ImageBankImportJobData } from "./workers/image-bank-import-worker";
import type { ImageBankTranslateJobData } from "./workers/image-bank-translate-worker";
import type { ImageBankCronJobData, ImageBankCronJobType } from "./workers/image-bank-crons-worker";
import type { ImageBankAutoConvertJobData } from "./workers/image-bank-auto-convert-worker";
import type { KitImportJobData } from "./workers/kit-import-worker";
import type { CalendlyPollJobData, CalendlyPollJobType } from "./workers/calendly-poll-worker";
import type { CrmSyncJobData, CrmSyncJobType } from "./workers/crm-sync-worker";
import { AUTO_CONVERT_QUEUE_NAME } from "@/server/image-bank/constants";
import type { FormationEngineJobData } from "./workers/qualiopi-formation-engine-worker";
import type {
  FormationCronJobData,
  FormationCronJobType,
} from "./workers/qualiopi-formation-crons-worker";

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

// `newsletterQueue` retirée le 2026-08-16 (audit de la chaîne d'envoi).
//
// Elle était déclarée, connectée à Redis, et n'avait NI producteur NI worker :
// aucun appelant dans tout le dépôt, aucun consommateur. Une file ouverte que
// personne ne remplit et que personne ne vide n'est pas une réserve pour plus
// tard — c'est une clé Redis qui laisse croire qu'un envoi de campagne existe.
// L'écrire le jour venu coûtera trois lignes ; la garder coûtait une ambiguïté
// permanente sur ce que le système sait faire.
//
// ⚠️ Conséquence à connaître avant la bascule ZeptoMail : ce dépôt n'envoie
// AUCUNE campagne de masse, et c'est ce qui rend la bascule légitime —
// ZeptoMail est un service transactionnel, y router du marketing en nombre est
// contraire à ses conditions et se solde par une suspension. Si une campagne
// doit exister un jour, elle passe par un autre canal, pas par ici.
// Le type `NewsletterCampaignJobData` reste dans `types.ts` pour cet usage.

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

/**
 * Sondage Calendly (2026-08-09) — la seule source de RDV temps quasi réel.
 *
 * Calendly Free n'émet AUCUN webhook, et depuis l'ADR 0038 le client réserve sur
 * calendly.com dans un nouvel onglet : plus rien ne prévient le site. Le sondage
 * tournait sur un cron GitHub Actions horaire, qui dérive fortement (trou de
 * 2 h 44 mesuré le 2026-08-09). Il passe donc ici, où BullMQ déclenche à la
 * minute.
 *
 * `attempts: 1` — un passage rate n'a pas à être rejoué : le suivant arrive dans
 * 60 secondes et repartira d'un état frais. Rejouer accumulerait des appels API
 * redondants sur un quota de 60 requêtes/minute.
 */
export const calendlyPollQueue: Queue<CalendlyPollJobData, void, CalendlyPollJobType> | null =
  connection
    ? new Queue<CalendlyPollJobData, void, CalendlyPollJobType>("calendly-poll", {
        connection,
        defaultJobOptions: {
          ...defaultJobOptions,
          attempts: 1,
          // Le sondage est à haute fréquence (1440 passages/jour) : sans
          // rétention courte, la file gonflerait pour rien.
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: { age: 24 * 3600, count: 200 },
        },
      })
    : null;

/**
 * Lot L2 (2026-08-14) — synchronisation sortante vers Axion CRM Pro.
 *
 * Deux types de jobs sur la même file :
 *   · `emit`  : émettre UNE ligne d'outbox, poussé juste après l'écriture
 *               métier — c'est la fraîcheur (« temps réel ») ;
 *   · `sweep` : balayer les lignes en attente ou en échec dont l'heure de
 *               nouvelle tentative est venue — c'est la GARANTIE. Si Redis, le
 *               worker ou le CRM sont tombés, c'est ce passage qui rattrape.
 *
 * `attempts: 1` : le rejeu n'est PAS confié à BullMQ mais à l'outbox
 * elle-même (colonnes `attempts` / `next_attempt_at`), qui survit à une purge
 * de Redis et reste inspectable en base. Deux mécanismes de retry superposés
 * produiraient des tentatives en rafale impossibles à raisonner.
 */
export const crmSyncQueue: Queue<CrmSyncJobData, void, CrmSyncJobType> | null = connection
  ? new Queue<CrmSyncJobData, void, CrmSyncJobType>("crm-sync", {
      connection,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 1,
        removeOnComplete: { age: 24 * 3600, count: 500 },
        removeOnFail: { age: 7 * 24 * 3600, count: 500 },
      },
    })
  : null;

/**
 * Lot L4 (2026-08-14) — passage quotidien du VIVIER candidats.
 *
 * Intègre au vivier CRM les candidatures dont la fenêtre d'opposition de
 * 30 jours est échue, sans opposition. File SÉPARÉE de `crm-sync` : celle-ci
 * transporte des événements, celle-là applique une règle de temps. Les mêler
 * ferait dépendre une horloge RGPD de la santé de la file de synchro.
 *
 * `attempts: 1` : rater un passage n'a aucune conséquence — le lendemain
 * reprendra exactement les mêmes lignes (l'état est en base, pas dans la file),
 * et une candidature dont la fenêtre est échue le reste. Rejouer n'apporterait
 * donc rien, sinon des doublons de trafic.
 */
export const vivierCronsQueue: Queue<VivierCronJobData, void, VivierCronJobType> | null = connection
  ? new Queue<VivierCronJobData, void, VivierCronJobType>("vivier-crons", {
      connection,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 1,
        removeOnComplete: { age: 7 * 24 * 3600, count: 50 },
        removeOnFail: { age: 30 * 24 * 3600, count: 100 },
      },
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
// Content Generator V1 — Sprint 4/5 queues (§ 13.1 master prompt v1.7)
// ============================================================
//
// Toutes les queues content-gen utilisent `attempts: 3` par défaut (fail-soft
// sur API IA / Redis temporairement indisponible). Les workers correspondants
// vivent sous `src/server/queue/workers/content-*-worker.ts` et leurs
// `startXxxWorker()` doivent être appelés depuis `src/server/queue/worker.ts`
// au démarrage du process worker.

/** Worker primaire — pick ContentGenJob, lance generator, écrit ReviewQueue. */
export const contentGenQueue: Queue | null = connection
  ? new Queue("content-gen", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

/** Orchestrateur — pick CoverageCampaign running, crée ContentGenJob rows. */
export const contentOrchestratorQueue: Queue | null = connection
  ? new Queue("content-orchestrator", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** Boucle qualité — re-prompt sections sous-score (§ 27 v1.7). */
export const contentQualityImproverQueue: Queue | null = connection
  ? new Queue("content-quality-improver", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/** RSS fetch — poll sources RSS configurées (§ 28 v1.7). */
export const contentRssFetchQueue: Queue | null = connection
  ? new Queue("content-rss-fetch", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** Similarity monitor — cron quotidien Jaccard scan (§ 25.5 v1.7). */
export const contentSimilarityMonitorQueue: Queue | null = connection
  ? new Queue("content-similarity-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** News lifecycle — cron quotidien archive RSS > 90j (§ 28.1 v1.7). */
export const contentNewsLifecycleQueue: Queue | null = connection
  ? new Queue("content-news-lifecycle", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/** Publish — insère Article DB après review approuvée (§ 14.1 v1.7). */
export const contentPublishQueue: Queue | null = connection
  ? new Queue("content-publish", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

/** IndexNow — POST api.indexnow.org à chaque publication tier-1 (§ 9bis.1). */
export const contentIndexNowQueue: Queue | null = connection
  ? new Queue("content-indexnow", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Q/R post-process auto (§ 29 master prompt v1.7 — Pass B fix P0-7).
 *
 * Hook post-publish : pour chaque article content-gen publié, extraire les
 * 8 Q/R du payload (faqJson) et créer une FAQ row par Q/R avec
 * `isAutoGenerated=true` + `parentArticleId`. URL plate `/fr/faq/<slug>`.
 * Anti-thin HCU : enrichment ≥ 300 mots requis V1.5+ (V1 = skeleton).
 */
export const contentQaExtractQueue: Queue | null = connection
  ? new Queue("content-qa-extract", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Fact-check Perplexity (Sprint 12.5 V2).
 *
 * Hook post-publish : pour chaque article publié, extrait claims chiffrés
 * (%, montants, ratios, attributions) et appelle Perplexity Sonar pour
 * valider/refuter. Remplit Article.factCheckScore. Coût ~$0.005/article.
 */
export const contentFactCheckQueue: Queue | null = connection
  ? new Queue("content-fact-check", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Tier lifecycle (Sprint 10 V2) — cron mensuel 15 du mois 06:00 UTC.
 * Scan les Articles tier-2 publiés ≥ 30j (promote candidates CTR > 5 %) +
 * tier-1 publiés ≥ 60j (demote candidates CTR < 1 %). Lit GSC API (skeleton
 * V1, activation Sprint 10.5 quand credentials JWT fournis par Will).
 */
export const contentTierLifecycleQueue: Queue | null = connection
  ? new Queue("content-tier-lifecycle", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Keyword sync (Sprint 12.5 V2) — cron hebdo lundi 04:00 UTC.
 * Query GSC API + SerpAPI pour chaque article publié ≥ 7j → upsert
 * KeywordTracking rows (position, CTR, impressions, clicks, delta).
 * SKELETON V1 (skip silencieux sans credentials).
 */
export const contentKeywordSyncQueue: Queue | null = connection
  ? new Queue("content-keyword-sync", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Web Vitals monitor (audit final fix P0-3) — cron daily 02:30 UTC.
 * Calcule p75 LCP/INP/CLS/FCP/TTFB/TBT sur fenêtre 24h depuis
 * `WebVitalSample` table (RUM /api/vitals). Alerte Telegram tag
 * MONITORING si dépasse budget AGENTS.md. Snapshot stocké dans
 * ContentGenConfig.web_vitals_p75 pour dashboard admin.
 */
export const contentWebVitalsMonitorQueue: Queue | null = connection
  ? new Queue("content-web-vitals-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * P2-29 (audit re-run 2026-05-15 AGENT 8) — PSI weekly monitor.
 * Cron Monday 03:00 UTC. Query PSI mobile sur 15 URLs stratégiques, persiste
 * dans WebVitalSample (navigationType=psi-lab), alerte Telegram si
 * Δ p75 PSI vs RUM > 50 %.
 */
export const contentPsiMonitorQueue: Queue | null = connection
  ? new Queue("content-psi-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint A 2026-05-21 D-P5-3 — Rapport qualité hebdomadaire content-gen.
 * Cron lundi 7h00 UTC (≈ 8h CET). KPIs publiés/rejetés/coût/villes/anomalies.
 * Destinataire : WEEKLY_REPORT_EMAIL, sinon l'adresse de l'organisme
 * (`lib/destinataires-internes.ts`). Ce commentaire annonçait encore un repli
 * sur une boîte Gmail personnelle, qui n'existe plus.
 */
export const contentWeeklyReportQueue: Queue | null = connection
  ? new Queue("content-weekly-report", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.2
 * Scheduler worker — cron every-5min — startDate → running.
 */
export const contentSchedulerQueue: Queue | null = connection
  ? new Queue("content-gen-scheduler", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22) — C.3
 * Deadline checker worker — cron 5 0 * * * — endDate auto-stop.
 */
export const contentDeadlineCheckerQueue: Queue | null = connection
  ? new Queue("content-gen-deadline-checker", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Phase F Sprint Perfection 2026 — Embeddings backfill daily 03:00 UTC.
 * Backfille les embeddings OpenAI (text-embedding-3-large, 1536 dims)
 * sur les articles publiés sans embedding (couche 4 dédup sémantique B.7).
 * Gate : OPENAI_EMBEDDINGS_ENABLED=true requis (défaut false).
 * Limite : 1 000 articles/run, cap OPENAI_EMBEDDINGS_MAX_TOKENS_PER_DAY.
 */
export const embeddingsBackfillQueue: Queue | null = connection
  ? new Queue("embeddings-backfill", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint H 2026-05-22 — Brand Voice Drift Monitor (cron daily 04:00 UTC).
 * Calcule la similarité cosine embeddings article vs référence brand voice.
 * Alerte (needs_review) si < 0.70, drift warning si < 0.80.
 */
export const brandVoiceDriftMonitorQueue: Queue | null = connection
  ? new Queue("brand-voice-drift-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Phase 8 Sprint Keywords Perfection 2026-05-22 — Keyword opportunity detector (cron lundi 06:00 UTC).
 * Détecte les keywords position > 10 avec opportunité 'high' + alertes rank-drop.
 */
export const keywordOpportunityDetectorQueue: Queue | null = connection
  ? new Queue("keyword-opportunity-detector", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint Final 2026-05-22 (P0-2 audit final) — Reset monthly cost counters cron
 * (1er du mois à 00:00 UTC). Sans ce cron, `resetMonthlyCostCounters()` n'est
 * jamais appelé, le compteur Redis du mois courant s'accumule indéfiniment et
 * le kill-switch global content-gen se déclenche à perpétuité dès le 1er mois.
 */
export const costCapResetQueue: Queue | null = connection
  ? new Queue("cost-cap-reset", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Observatoire IA 2026 — auto-update du snapshot + synthèse LLM (toutes les 6 h).
 * Recompute agrégats/segments/historique + régénère l'analyse si l'effectif a
 * changé + purge CF. Sans ce cron, les chiffres publics ne bougent que sur clic
 * admin « Recalculer le snapshot ».
 */
export const observatoireSnapshotQueue: Queue | null = connection
  ? new Queue("observatoire-snapshot", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Sprint Final 2026-05-22 (P0-3 audit final) — External links monthly HEAD
 * check cron (1er du mois à 02:00 UTC). Worker existait depuis Sprint External
 * Links Database 2026-05-22 mais n'avait pas de cron déclencheur.
 * Gate `EXTERNAL_LINKS_MONITOR_ENABLED=true` requise côté worker (no-op sinon).
 */
export const externalLinksMonitorQueue: Queue | null = connection
  ? new Queue("external-links-monitor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

// Sprint Site Explorer Admin 2026-05-22 — inspection quotidienne + détection anomalies.
export const siteRouteInspectorQueue: Queue<SiteRouteInspectorJobData> | null = connection
  ? new Queue<SiteRouteInspectorJobData>("site-route-inspector", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

export const siteRouteAnomalyDetectorQueue: Queue<SiteRouteAnomalyDetectorJobData> | null =
  connection
    ? new Queue<SiteRouteAnomalyDetectorJobData>("site-route-anomaly-detector", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
      })
    : null;

// Onglet « Toutes les URLs » 2026-06-08 — découverte « vivante » + trafic GSC.
export const siteRouteDiscoveryQueue: Queue<SiteRouteDiscoveryJobData> | null = connection
  ? new Queue<SiteRouteDiscoveryJobData>("site-route-discovery", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

export const siteRouteGscQueue: Queue<SiteRouteGscJobData> | null = connection
  ? new Queue<SiteRouteGscJobData>("site-route-gsc", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

/**
 * Méta-cert 2026-05-15 AGENT 19 — health monitoring multi-check (cron hourly).
 * Câble les helpers Telegram ready-to-call non-câblés :
 *  - `alertQueueStuck` (BullMQ waiting count stable > 30 min)
 *  - `alertSoft404Detected` (link-checker tier-1 HEAD samples)
 *  - `alertIndexationStagnant` (Article tier_1 sans `indexedAt` > 30 j)
 *
 * Cron pattern : `15 * * * *` (xx:15 every hour, décalé pour ne pas
 * coïncider avec content-orchestrator-cron à xx:00 / xx:15 / xx:30 / xx:45.
 */
export const contentMonitoringQueue: Queue | null = connection
  ? new Queue("content-monitoring", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    })
  : null;

// ============================================================
// Image Bank V1 (Sprint 1-7 feat/image-bank-v1) — 4 queues
// Patch post-audit 2026-05-16 P1-2 + P1-4 (activation + retry/backoff).
// Constants : src/server/image-bank/constants.ts (ENRICH_ATTEMPTS=3,
// ENRICH_BACKOFF_DELAY_MS=5000).
// ============================================================

const IMAGE_BANK_JOB_OPTIONS = {
  ...defaultJobOptions,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
};

export const imageBankEnrichQueue: Queue<ImageBankEnrichJobData, void, string> | null = connection
  ? new Queue<ImageBankEnrichJobData, void, string>("image-bank-enrich", {
      connection,
      defaultJobOptions: IMAGE_BANK_JOB_OPTIONS,
    })
  : null;

export const imageBankImportQueue: Queue<ImageBankImportJobData, void, string> | null = connection
  ? new Queue<ImageBankImportJobData, void, string>("image-bank-import", {
      connection,
      defaultJobOptions: { ...IMAGE_BANK_JOB_OPTIONS, attempts: 2 },
    })
  : null;

// Import en masse de kit de formation (ZIP → documents-interventions).
export const kitImportQueue: Queue<KitImportJobData, void, string> | null = connection
  ? new Queue<KitImportJobData, void, string>("kit-import", { connection, defaultJobOptions })
  : null;

export async function enqueueKitImport(runId: string): Promise<void> {
  if (!kitImportQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(`[bullmq] no connection, skipping enqueueKitImport(${runId})`);
    }
    return;
  }
  await kitImportQueue.add(`kit-import-${runId}`, { runId }, { jobId: `kit-import-${runId}` });
}

export const imageBankAutoConvertQueue: Queue<
  ImageBankAutoConvertJobData,
  { lqipBase64: string; slug: string },
  string
> | null = connection
  ? new Queue<ImageBankAutoConvertJobData, { lqipBase64: string; slug: string }, string>(
      AUTO_CONVERT_QUEUE_NAME,
      { connection, defaultJobOptions: { ...IMAGE_BANK_JOB_OPTIONS, attempts: 3 } },
    )
  : null;

export const imageBankTranslateQueue: Queue<ImageBankTranslateJobData, void, string> | null =
  connection
    ? new Queue<ImageBankTranslateJobData, void, string>("image-bank-translate", {
        connection,
        defaultJobOptions: IMAGE_BANK_JOB_OPTIONS,
      })
    : null;

export const imageBankCronsQueue: Queue<ImageBankCronJobData, void, ImageBankCronJobType> | null =
  connection
    ? new Queue<ImageBankCronJobData, void, ImageBankCronJobType>("image-bank-crons", {
        connection,
        defaultJobOptions: { ...IMAGE_BANK_JOB_OPTIONS, attempts: 1 },
      })
    : null;

// ============================================================
// Qualiopi — Formation Engine T4 (génération IA pédagogique).
// Env-gated côté worker ; queue toujours présente pour les Server Actions.
// ============================================================

// ============================================================
// Qualiopi — Formation Crons T6 (auto-transitions session : date_debut, cloture_auto).
// Queue séparée de formation-engine pour isolation des responsabilités.
// ============================================================

export const formationCronsQueue: Queue<FormationCronJobData, void, FormationCronJobType> | null =
  connection
    ? new Queue<FormationCronJobData, void, FormationCronJobType>("formation-crons", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      })
    : null;

export const formationEngineQueue: Queue<FormationEngineJobData> | null = connection
  ? new Queue<FormationEngineJobData>("formation-engine", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
    })
  : null;

/**
 * Enfile un job Formation Engine. No-op si BullMQ désactivé.
 * Utilisé par startGenerationAction + approveFileValidationAction.
 */
export async function enqueueFormationGeneration(data: FormationEngineJobData): Promise<void> {
  if (!formationEngineQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueFormationGeneration(${data.formationId})`,
      );
    }
    return;
  }
  // jobId unique par formationId pour éviter les doublons de jobs en attente
  await formationEngineQueue.add(`formation-engine-${data.formationId}`, data, {
    jobId: `fme-${data.formationId}-${Date.now()}`,
  });
}

// ============================================================
// Chatbot (T-05) — ingestion RAG chat_kb_chunks (env-gated CHATBOT_ENABLED côté worker).
// ============================================================

export const chatbotIngestQueue: Queue | null = connection
  ? new Queue("chatbot-ingest", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

/** Enqueue une reconstruction de l'index RAG chatbot. No-op si BullMQ off. */
export async function enqueueChatbotIngest(): Promise<void> {
  if (!chatbotIngestQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn("[bullmq] no connection, skipping enqueueChatbotIngest");
    }
    return;
  }
  await chatbotIngestQueue.add("ingest", { tick: new Date().toISOString() });
}

// ============================================================
// Helpers d'enqueue typés (utilises par Server Actions)
// ============================================================

/**
 * Image Bank V1 — enqueue helpers (Server Actions / workers internal).
 *
 * No-op proprement si BullMQ désactivé ou pas de connection Redis (build
 * GH Actions avec REDIS_URL=stub.invalid). Pattern aligné sur `enqueueEmail`.
 */
export async function enqueueImageBankEnrich(data: ImageBankEnrichJobData): Promise<void> {
  if (!imageBankEnrichQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(`[bullmq] no connection, skipping enqueueImageBankEnrich(${data.imageId})`);
    }
    return;
  }
  await imageBankEnrichQueue.add(`enrich-${data.imageId}`, data);
}

export async function enqueueImageBankImport(data: ImageBankImportJobData): Promise<void> {
  if (!imageBankImportQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueImageBankImport(${data.originalFilename})`,
      );
    }
    return;
  }
  await imageBankImportQueue.add(`import-${data.batchId ?? "single"}-${Date.now()}`, data);
}

export async function enqueueImageBankTranslate(data: ImageBankTranslateJobData): Promise<void> {
  if (!imageBankTranslateQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueImageBankTranslate(${data.imageId} ${data.sourceLang}→${data.targetLang})`,
      );
    }
    return;
  }
  await imageBankTranslateQueue.add(
    `translate-${data.imageId}-${data.sourceLang}-${data.targetLang}`,
    data,
  );
}

export async function enqueueImageBankAutoConvert(
  data: ImageBankAutoConvertJobData,
): Promise<void> {
  if (!imageBankAutoConvertQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(
        `[bullmq] no connection, skipping enqueueImageBankAutoConvert(${data.targetSlug})`,
      );
    }
    return;
  }
  await imageBankAutoConvertQueue.add(`convert-${data.targetSlug}`, data, {
    jobId: data.targetSlug,
  });
}

export async function enqueueEmail(
  template: EmailJobName,
  to: string,
  locale: "fr" | "en",
  payload: Record<string, unknown>,
  options?: {
    delayMs?: number;
    marketing?: boolean;
    jobId?: string;
    /** Entité liée (traçabilité EmailLog) — ex. AlerteSysteme/alerteId. */
    entityType?: string;
    entityId?: string;
    /** PJ (clé R2, jamais de binaire dans Redis) — Hub facturation. */
    attachments?: Array<{ filename: string; r2Key: string; contentType?: string }>;
    /**
     * Client concerné — sert au réglage d'automatisation PAR CLIENT (F60).
     * Sans lui, seules les règles globales s'appliquent.
     */
    clientId?: string | null;
    /**
     * Sujet lisible, utilisé UNIQUEMENT quand l'email part en validation :
     * l'écran d'approbation doit montrer quelque chose avant le rendu complet.
     * Sans lui, un email garé s'afficherait sous son nom technique.
     */
    sujet?: string;
    /**
     * Court-circuite la validation. Réservé à l'envoi DEPUIS la corbeille, une
     * fois l'email approuvé — sinon on bouclerait indéfiniment.
     */
    bypassValidation?: boolean;
  },
): Promise<{ enqueued: boolean; garePourValidation?: boolean; outboxId?: string }> {
  if (!emailsQueue) {
    if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
      console.warn(`[bullmq] no connection, skipping enqueueEmail(${template}, ${to})`);
    }
    // Retour détectable : les appelants qui exigent une garantie de mise en file
    // (ex. reply admin) peuvent marquer un échec explicite au lieu d'un faux succès.
    return { enqueued: false };
  }
  // 🔴 Audit certification 2026-07-26 (F60) — corbeille de validation.
  //
  // Les emails commerciaux (relance d'impayé, devis, facture, contrat) sont
  // garés pour relecture ; la chaîne Qualiopi part seule. Voir `outbox-policy.ts`
  // pour le raisonnement — retenir une convocation exposerait un stagiaire à ne
  // jamais la recevoir, et les indicateurs 4, 9, 11, 30 et 32 en dépendent.
  //
  // Toute défaillance de cette couche retombe sur l'envoi direct : l'incertitude
  // ne doit jamais retenir un email.
  if (options?.bypassValidation !== true) {
    const mode = await resoudreMode(template, options?.clientId ?? null);
    if (mode === "validation") {
      const outboxId = await garerPourValidation({
        template,
        recipient: to,
        locale,
        payload,
        sujet: options?.sujet ?? template,
        clientId: options?.clientId ?? null,
        entityType: options?.entityType ?? null,
        entityId: options?.entityId ?? null,
        ...(options?.attachments ? { attachments: options.attachments } : {}),
      });
      if (outboxId !== null) {
        return { enqueued: false, garePourValidation: true, outboxId };
      }
      // Mise en attente impossible : on envoie plutôt que de perdre le message.
    }
  }

  const data: EmailJobData = {
    template,
    to,
    locale,
    payload,
    ...(options?.marketing ? { marketing: true } : {}),
    ...(options?.entityType ? { entityType: options.entityType } : {}),
    ...(options?.entityId ? { entityId: options.entityId } : {}),
    ...(options?.attachments && options.attachments.length > 0
      ? { attachments: options.attachments }
      : {}),
  };
  const addOptions: Record<string, unknown> = {};
  if (options?.delayMs) addOptions["delay"] = options.delayMs;
  if (options?.jobId) addOptions["jobId"] = options.jobId;
  const job = await emailsQueue.add(
    template,
    data,
    Object.keys(addOptions).length > 0 ? addOptions : undefined,
  );

  // 🔴 Audit du 2026-08-16 — la ligne « en attente » qui manquait.
  //
  // `EmailLogStatus.pending` existait au schéma et n'était JAMAIS écrit : le
  // worker ne créait la ligne qu'à l'issue de la tentative. Un job enfilé mais
  // jamais consommé — worker mort, Redis coupé — ne laissait donc aucune trace,
  // et la console affichait « 0 échec », rigoureusement indistinguable de
  // « aucun e-mail à envoyer ».
  //
  // On pose la ligne ICI, le worker la clôt. Une ligne restée `pending` est
  // désormais le signal d'une chaîne rompue, et `verifierSanteEmails()` la lit.
  //
  // `await` volontaire plutôt qu'un `void` : la fonction ne lève jamais (elle
  // avale ses propres erreurs), et l'attendre garantit que la ligne existe
  // avant que le worker ne cherche à la clôturer — sinon on créerait deux
  // lignes pour un seul envoi sur les files rapides.
  //
  // ⚠️ `submission-reply` est le SEUL gabarit exclu, et l'exclusion est
  // nécessaire, pas cosmétique. Ce chemin n'a jamais écrit dans `email_logs` :
  // il porte son propre suivi, plus riche, sur `SubmissionReply`
  // (`deliveryStatus` / `sentAt` / `failedAt` / `errorMsg` / `retryCount`), et
  // le worker sort par un `return` anticipé sans passer par `cloturerJournal`.
  // Deux conséquences si on l'enfilait ici :
  //   - la ligne resterait `pending` À VIE, et `verifierSanteEmails()` lèverait
  //     une alerte CRITIQUE « e-mails bloqués en file » dès la première réponse
  //     admin — une surveillance neuve qui crie sur son propre bruit se fait
  //     désarmer en trois jours ;
  //   - elle porterait `recipient: ""`, l'appelant passant une adresse vide
  //     exprès (aucune PII dans le payload de file, le worker la déchiffre
  //     depuis la base).
  // Le fait que la page « E-mails envoyés » omette les réponses admin reste un
  // constat OUVERT de l'audit — il se corrige côté lecture, pas en fabriquant
  // ici des lignes qui ne seront jamais closes.
  if (template !== "submission-reply") {
    await journaliserEnAttente({
      template,
      recipient: to,
      locale,
      marketing: options?.marketing === true,
      jobId: job.id,
      ...(options?.entityType ? { entityType: options.entityType } : {}),
      ...(options?.entityId ? { entityId: options.entityId } : {}),
    });
  }

  return { enqueued: true };
}

/**
 * Interrupteur des workers/crons hérités du flux de réservation payante
 * (`option-expiration`, `option-reminder`, `booking-crons`).
 *
 * OFF par défaut depuis l'audit 2026-07-09 : ce flux est éteint (Calendly a
 * remplacé le créneau public, Stripe est neutralisé) et ces crons tournaient à
 * vide. Poser `LEGACY_BOOKING_WORKERS_ENABLED=true` (scope RUN) pour les
 * réactiver — `bootRepeatableJobs()` les replanifie et `worker.ts` redémarre
 * les 3 workers.
 *
 * SSOT partagée : consommée par `bootRepeatableJobs()` (ici) ET par `worker.ts`.
 */
export function isLegacyBookingWorkersEnabled(): boolean {
  return process.env.LEGACY_BOOKING_WORKERS_ENABLED === "true";
}

/**
 * Purge les restes Redis d'une file legacy DORMANTE (flag ci-dessus a false).
 *
 * LE PIEGE : `removeOnComplete` / `removeOnFail` ne rognent la retention qu'a
 * l'EXECUTION d'un job. Une file sans consommateur ne trime donc plus jamais —
 * son stock reste fige A VIE, pile au plafond. Mesure en prod le 2026-07-26 :
 * 6 005 cles `bull:option-expiration:*`, 726 pour `option-reminder`, 245 pour
 * `booking-crons` — 6 976 cles immortelles pour zero job utile. Les ZSET
 * `repeat` des trois files sont a 0 : la decommission du commit 2c377916 a bien
 * fonctionne, il ne reste que les carcasses de jobs. Rien a rallumer.
 *
 * POURQUOI `clean()` ET SURTOUT PAS `obliterate()` : `obliterate()` commence par
 * `await this.pause()` (bullmq 5.76.8, queue.js:584) et ne supprime la cle
 * `meta` — donc le drapeau `paused` — qu'a la toute fin de son script Lua. Une
 * coupure Redis entre les deux laisse la file PAUSEE de facon permanente, et
 * personne ne le verrait puisque la file est dormante. Le piege se declencherait
 * le jour ou quelqu'un repose `LEGACY_BOOKING_WORKERS_ENABLED=true` : les crons
 * seraient replanifies mais jamais consommes. `clean()` ne touche jamais a
 * l'etat de la file.
 *
 * POURQUOI SEULEMENT `completed` ET `failed` : ce sont des dechets par
 * construction. On ne touche NI a `wait` NI a `delayed`, qui seraient du travail
 * en attente si un producteur reapparaissait.
 *
 * Best-effort : de l'entretien ne doit jamais empecher le worker de demarrer.
 */
async function purgeDormantLegacyQueue(queue: Pick<Queue, "clean">, label: string): Promise<void> {
  try {
    // grace=0 (tout est purgeable) + limit=0 → bullmq traduit en Infinity et
    // boucle par lots de 10 000 jusqu'a epuisement (queue.js:546-561).
    const completed = await queue.clean(0, 0, "completed");
    const failed = await queue.clean(0, 0, "failed");
    const total = completed.length + failed.length;
    if (total > 0) {
      console.warn(`[bullmq] file legacy dormante ${label} : ${total} jobs residuels purges`);
    }
  } catch (err) {
    console.warn(
      `[bullmq] purge des restes de ${label} impossible (non bloquant) :`,
      err instanceof Error ? err.message : String(err),
    );
  }
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
  // ⚠️ Le garde ne dépend QUE de `retentionPurgeQueue` (purge RGPD, vivante).
  //    Avant l'audit 2026-07-09 il exigeait aussi `optionExpirationQueue` et
  //    `optionReminderQueue` : la purge RGPD quotidienne était donc silencieusement
  //    court-circuitée si l'une de ces queues legacy manquait. Bug latent corrigé.
  if (!retentionPurgeQueue) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[bullmq] no connection, skipping bootRepeatableJobs");
    }
    return;
  }

  // ── Crons legacy « réservation payante » — DÉSACTIVÉS par défaut ──────────
  //   Le flux booking payant est éteint (audit 2026-07-09) : Calendly a remplacé
  //   le créneau public (`createBookingAction`/`postOption48hAction` n'existent
  //   plus) et Stripe est neutralisé. Ces crons tournaient à vide :
  //     · option-expiration → toutes les 5 min (288 exécutions/jour)
  //     · option-reminder   → toutes les heures
  //     · booking-crons     → 11 crons (relances paiement, J-7/J-1, cadrages…)
  //
  //   IMPORTANT : les repeatable jobs BullMQ PERSISTENT dans Redis. Ne plus les
  //   `add()` ne suffit pas — on appelle donc TOUJOURS `removeRepeatable()` pour
  //   purger les entrées déjà enregistrées, sinon elles continueraient à se
  //   déclencher et les jobs s'empileraient sans consommateur (les workers
  //   correspondants ne démarrent plus, cf. worker.ts).
  //
  //   Réversible : poser `LEGACY_BOOKING_WORKERS_ENABLED=true` (scope RUN) →
  //   les crons sont re-planifiés ici ET les 3 workers redémarrent.
  const legacyBookingEnabled = isLegacyBookingWorkersEnabled();

  if (optionExpirationQueue) {
    // Cron 5min : libere les options 48h expirees
    await optionExpirationQueue.removeRepeatable(
      "tick",
      { pattern: "*/5 * * * *" },
      "option-expiration-cron",
    );
    if (legacyBookingEnabled) {
      await optionExpirationQueue.add(
        "tick",
        { tick: new Date().toISOString() },
        { repeat: { pattern: "*/5 * * * *" }, jobId: "option-expiration-cron" },
      );
    }
  }

  if (optionReminderQueue) {
    // Cron 1h : envoie rappel H+24 (fenetre [22h,26h] post-fix Fork 1 C3)
    await optionReminderQueue.removeRepeatable(
      "tick",
      { pattern: "0 * * * *" },
      "option-reminder-cron",
    );
    if (legacyBookingEnabled) {
      await optionReminderQueue.add(
        "tick",
        { tick: new Date().toISOString() },
        { repeat: { pattern: "0 * * * *" }, jobId: "option-reminder-cron" },
      );
    }
  }

  // Sprint 24 / D3 — RGPD purge quotidienne 03:00 UTC. VIVANT — toujours planifié.
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

  // ── Sondage Calendly (2026-08-09) — VIVANT, c'est le canal de RDV réel ─────
  //
  // Deux passes à deux cadences, pour tenir le quota de 60 requêtes/minute de
  // l'API Calendly. Le raisonnement complet est dans l'en-tête de
  // `workers/calendly-poll-worker.ts` — NE PAS accélérer `refresh` sans le lire.
  if (calendlyPollQueue) {
    const calendlySchedule: Array<{
      type: CalendlyPollJobType;
      pattern: string;
      jobId: string;
    }> = [
      // Découverte des réservations prises sur calendly.com : à la minute.
      // C'est CE passage qui porte la promesse « moins de 60 s ».
      { type: "discover", pattern: "* * * * *", jobId: "calendly-discover-cron" },
      // Annulations et déplacements : toutes les 10 min (jusqu'à ~50 requêtes).
      { type: "refresh", pattern: "*/10 * * * *", jobId: "calendly-refresh-cron" },
    ];

    // 🔴 Purge EXHAUSTIVE avant ré-enregistrement, et pas le
    // `removeRepeatable(type, { pattern }, jobId)` utilisé partout ailleurs dans
    // ce fichier : celui-ci ne sait retirer QUE le pattern qu'on lui passe. Le
    // jour où l'on change une cadence, l'ancienne entrée reste dans Redis — les
    // repeatable jobs y PERSISTENT — et les DEUX se déclenchent. Sur une file
    // qui tourne à la minute et consomme un quota API, ce doublon silencieux
    // coûterait cher et ne se verrait nulle part. On liste donc l'existant et on
    // retire tout ce qui n'est plus au programme.
    const wanted = new Set(calendlySchedule.map((s) => `${s.type}|${s.pattern}`));
    for (const existing of await calendlyPollQueue.getRepeatableJobs()) {
      if (!wanted.has(`${existing.name}|${existing.pattern}`)) {
        await calendlyPollQueue.removeRepeatableByKey(existing.key);
        console.warn(
          `[bullmq] calendly-poll : entrée répétable obsolète retirée (${existing.name} @ ${existing.pattern})`,
        );
      }
    }

    for (const { type, pattern, jobId } of calendlySchedule) {
      await calendlyPollQueue.add(
        type,
        { type, tick: new Date().toISOString() },
        { repeat: { pattern }, jobId },
      );
    }
  }

  // ── Lot L2 — balayage de l'outbox CRM ────────────────────────────────────
  // Toutes les 10 minutes. C'est le RATTRAPAGE : l'émission immédiate est un
  // confort, ce passage est la garantie de livraison. Il tourne même quand le
  // drapeau `CRM_SYNC_ENABLED` est à OFF — et ne trouve alors rien, puisque
  // dans cet état aucune ligne n'est jamais écrite.
  if (crmSyncQueue) {
    await crmSyncQueue.removeRepeatable(
      "sweep",
      { pattern: "*/10 * * * *" },
      "crm-sync-sweep-cron",
    );
    await crmSyncQueue.add(
      "sweep",
      { type: "sweep" },
      { repeat: { pattern: "*/10 * * * *" }, jobId: "crm-sync-sweep-cron" },
    );

    // ── Lot L5 — réconciliation QUOTIDIENNE ────────────────────────────────
    // 04 h 30 UTC : creux de trafic, et surtout APRÈS que la nuit a laissé au
    // balayage toutes ses chances de rattraper. Comparer avant les rattrapages
    // ferait remonter comme « manquant » ce qui n'était que « pas encore parti ».
    //
    // Le balayage donne la FRAÎCHEUR, ce passage donne la GARANTIE : il compare
    // les enregistrements source aux `subject_ref` réellement émis et journalise
    // ses compteurs même quand tout va bien (l'absence de nouvelles doit être
    // visible, leçon IndexNow). Drapeau à OFF ⇒ sortie immédiate.
    await crmSyncQueue.removeRepeatable(
      "reconcile",
      { pattern: "30 4 * * *" },
      "crm-sync-reconcile-cron",
    );
    await crmSyncQueue.add(
      "reconcile",
      { type: "reconcile" },
      { repeat: { pattern: "30 4 * * *" }, jobId: "crm-sync-reconcile-cron" },
    );
  }

  // ── Lot L4 — intégration au vivier à J+30 ────────────────────────────────
  // Une fois par jour à 05:00 UTC (créneau libre : 03:00 et 04:00 sont déjà
  // chargés — purge RGPD, embeddings, brand-voice). La cadence quotidienne
  // suffit : la règle porte sur des JOURS, pas sur des minutes, et un passage
  // manqué est rattrapé par le suivant sans perte (l'état vit en base).
  //
  // Il tourne même quand les drapeaux sont à OFF — et ne trouve alors rien,
  // puisque dans cet état aucune candidature n'a jamais été informée.
  if (vivierCronsQueue) {
    await vivierCronsQueue.removeRepeatable(
      "integrate-stock",
      { pattern: "0 5 * * *" },
      "vivier-integrate-stock-cron",
    );
    await vivierCronsQueue.add(
      "integrate-stock",
      { type: "integrate-stock", tick: new Date().toISOString() },
      { repeat: { pattern: "0 5 * * *" }, jobId: "vivier-integrate-stock-cron" },
    );
  }

  // Sprint X.12 — Booking V1 crons (legacy, cf. bloc ci-dessus).
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
      // Purge systématique de l'entrée repeatable Redis (cf. bloc legacy ci-dessus).
      await bookingCronsQueue.removeRepeatable(type, { pattern }, jobId);
      if (legacyBookingEnabled) {
        await bookingCronsQueue.add(
          type,
          { type, tick: new Date().toISOString() },
          { repeat: { pattern }, jobId },
        );
      }
    }
  }

  // ============================================================
  // Content Generator V1 — crons content-gen (§ 13.2 master prompt v1.7)
  // ============================================================
  //
  // 5 crons content-gen :
  //  - orchestrator : toutes les 15 min — pick CoverageCampaign running, enqueue ContentGenJob
  //  - rss-fetch : toutes les heures — poll sources RSS
  //  - similarity-monitor : quotidien 04:30 UTC — Jaccard scan top 100 pairs
  //  - news-lifecycle : quotidien 05:00 UTC — archive RSS > 90j
  //
  // Le worker primaire (`content-gen`) + publish + quality-improver + indexnow
  // sont event-driven (pas de cron — déclenchés via enqueue depuis Server Actions
  // ou autres workers).

  if (contentOrchestratorQueue) {
    await contentOrchestratorQueue.removeRepeatable(
      "tick",
      { pattern: "*/15 * * * *" },
      "content-orchestrator-cron",
    );
    await contentOrchestratorQueue.add(
      "tick",
      { trigger: "cron-15min", tick: new Date().toISOString() },
      { repeat: { pattern: "*/15 * * * *" }, jobId: "content-orchestrator-cron" },
    );
  }

  if (contentRssFetchQueue) {
    await contentRssFetchQueue.removeRepeatable(
      "tick",
      { pattern: "0 * * * *" },
      "content-rss-fetch-cron",
    );
    await contentRssFetchQueue.add(
      "tick",
      { trigger: "cron-hourly", tick: new Date().toISOString() },
      { repeat: { pattern: "0 * * * *" }, jobId: "content-rss-fetch-cron" },
    );
  }

  if (contentSimilarityMonitorQueue) {
    await contentSimilarityMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "30 4 * * *" },
      "content-similarity-monitor-cron",
    );
    await contentSimilarityMonitorQueue.add(
      "tick",
      { trigger: "cron-daily-0430", tick: new Date().toISOString() },
      { repeat: { pattern: "30 4 * * *" }, jobId: "content-similarity-monitor-cron" },
    );
  }

  if (contentNewsLifecycleQueue) {
    await contentNewsLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 5 * * *" },
      "content-news-lifecycle-cron",
    );
    await contentNewsLifecycleQueue.add(
      "tick",
      { trigger: "cron-daily-0500", tick: new Date().toISOString() },
      { repeat: { pattern: "0 5 * * *" }, jobId: "content-news-lifecycle-cron" },
    );
  }

  // Sprint 10 V2 — tier-lifecycle daily (06:00 UTC).
  // Audit indexation 2026-05-18 — pattern mensuel → daily pour scale
  // 500 articles/jour. removeRepeatable des 2 patterns idempotence migration.
  if (contentTierLifecycleQueue) {
    await contentTierLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 15 * *" },
      "content-tier-lifecycle-cron",
    );
    await contentTierLifecycleQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 * * *" },
      "content-tier-lifecycle-cron",
    );
    await contentTierLifecycleQueue.add(
      "tick",
      { trigger: "cron-daily-0600", tick: new Date().toISOString() },
      { repeat: { pattern: "0 6 * * *" }, jobId: "content-tier-lifecycle-cron" },
    );
  }

  // Sprint 12.5 V2 — keyword sync hebdo (lundi 04:00 UTC).
  if (contentKeywordSyncQueue) {
    await contentKeywordSyncQueue.removeRepeatable(
      "tick",
      { pattern: "0 4 * * 1" },
      "content-keyword-sync-cron",
    );
    await contentKeywordSyncQueue.add(
      "tick",
      { trigger: "cron-weekly-mon-0400", tick: new Date().toISOString() },
      { repeat: { pattern: "0 4 * * 1" }, jobId: "content-keyword-sync-cron" },
    );
  }

  // Audit final fix P0-3 — Web Vitals monitor daily 02:30 UTC.
  if (contentWebVitalsMonitorQueue) {
    await contentWebVitalsMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "30 2 * * *" },
      "content-web-vitals-monitor-cron",
    );
    await contentWebVitalsMonitorQueue.add(
      "tick",
      { trigger: "cron-daily-0230", tick: new Date().toISOString() },
      { repeat: { pattern: "30 2 * * *" }, jobId: "content-web-vitals-monitor-cron" },
    );
  }

  // P2-29 (audit re-run 2026-05-15) — PSI monitor weekly Monday 03:00 UTC.
  if (contentPsiMonitorQueue) {
    await contentPsiMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "0 3 * * 1" },
      "content-psi-monitor-cron",
    );
    await contentPsiMonitorQueue.add(
      "tick",
      { trigger: "cron-weekly-mon-0300", tick: new Date().toISOString() },
      { repeat: { pattern: "0 3 * * 1" }, jobId: "content-psi-monitor-cron" },
    );
  }

  // Méta-cert 2026-05-15 AGENT 19 — content-monitoring hourly @ xx:15.
  // Câble alertQueueStuck + alertSoft404Detected + alertIndexationStagnant.
  if (contentMonitoringQueue) {
    await contentMonitoringQueue.removeRepeatable(
      "tick",
      { pattern: "15 * * * *" },
      "content-monitoring-cron",
    );
    await contentMonitoringQueue.add(
      "tick",
      { trigger: "cron-hourly-xx15", tick: new Date().toISOString() },
      { repeat: { pattern: "15 * * * *" }, jobId: "content-monitoring-cron" },
    );
  }

  // Sprint A 2026-05-21 D-P5-3 — rapport qualité hebdomadaire lundi 7h00 UTC (≈ 8h CET).
  if (contentWeeklyReportQueue) {
    await contentWeeklyReportQueue.removeRepeatable(
      "tick",
      { pattern: "0 7 * * 1" },
      "content-weekly-report-cron",
    );
    await contentWeeklyReportQueue.add(
      "tick",
      { trigger: "cron-weekly-mon-0700", tick: new Date().toISOString() },
      { repeat: { pattern: "0 7 * * 1" }, jobId: "content-weekly-report-cron" },
    );
  }

  // Sprint Campaign Controls C.2 — scheduler worker toutes les 5 min.
  if (contentSchedulerQueue) {
    await contentSchedulerQueue.removeRepeatable(
      "tick",
      { pattern: "*/5 * * * *" },
      "content-gen-scheduler-cron",
    );
    await contentSchedulerQueue.add(
      "tick",
      { trigger: "cron-5min", tick: new Date().toISOString() },
      { repeat: { pattern: "*/5 * * * *" }, jobId: "content-gen-scheduler-cron" },
    );
  }

  // Sprint Campaign Controls C.3 — deadline checker every 15 min.
  // Sprint Correctif P1 (2026-05-23 — audit E2E passe 2 runtime) : passage du
  // pattern daily `5 0 * * *` → `*/15 * * * *`. Granularité 24h trop coarse
  // pour les campagnes avec endDate sub-day (ex: endDate=T+10min stoppait
  // au prochain 00:05 UTC = ~24h de retard). 15min suffit pour respecter
  // les endDate utilisateur sans saturer le scheduler.
  // Idempotence : ancien jobId `content-gen-deadline-checker-cron` retiré via
  // removeRepeatable (les 2 patterns sont nettoyés pour migration safe).
  if (contentDeadlineCheckerQueue) {
    // Retire l'ancien pattern daily (migration idempotente)
    await contentDeadlineCheckerQueue.removeRepeatable(
      "tick",
      { pattern: "5 0 * * *" },
      "content-gen-deadline-checker-cron",
    );
    // Retire le nouveau pattern aussi (idempotent re-add)
    await contentDeadlineCheckerQueue.removeRepeatable(
      "tick",
      { pattern: "*/15 * * * *" },
      "content-gen-deadline-checker-cron",
    );
    await contentDeadlineCheckerQueue.add(
      "tick",
      { trigger: "cron-15min", tick: new Date().toISOString() },
      { repeat: { pattern: "*/15 * * * *" }, jobId: "content-gen-deadline-checker-cron" },
    );
  }

  // Phase F Sprint Perfection 2026 — embeddings backfill daily 03:00 UTC.
  // Gate : OPENAI_EMBEDDINGS_ENABLED=true (le worker gère le skip silencieux si false).
  if (embeddingsBackfillQueue) {
    await embeddingsBackfillQueue.removeRepeatable(
      "tick",
      { pattern: "0 3 * * *" },
      "embeddings-backfill-cron",
    );
    await embeddingsBackfillQueue.add(
      "tick",
      { trigger: "cron-daily-0300", tick: new Date().toISOString() },
      { repeat: { pattern: "0 3 * * *" }, jobId: "embeddings-backfill-cron" },
    );
  }

  // Sprint H 2026-05-22 — Brand Voice Drift Monitor daily 04:00 UTC.
  if (brandVoiceDriftMonitorQueue) {
    await brandVoiceDriftMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "0 4 * * *" },
      "brand-voice-drift-monitor-cron",
    );
    await brandVoiceDriftMonitorQueue.add(
      "tick",
      { trigger: "cron-daily-0400", tick: new Date().toISOString() },
      { repeat: { pattern: "0 4 * * *" }, jobId: "brand-voice-drift-monitor-cron" },
    );
  }

  // Phase 8 Keywords Perfection 2026-05-22 — Keyword opportunity detector (lundi 06:00 UTC)
  if (keywordOpportunityDetectorQueue) {
    await keywordOpportunityDetectorQueue.removeRepeatable(
      "tick",
      { pattern: "0 6 * * 1" },
      "keyword-opportunity-detector-cron",
    );
    await keywordOpportunityDetectorQueue.add(
      "tick",
      { trigger: "cron-weekly-monday-0600", tick: new Date().toISOString() },
      { repeat: { pattern: "0 6 * * 1" }, jobId: "keyword-opportunity-detector-cron" },
    );
  }

  // Sprint Final 2026-05-22 — Reset cost counters monthly (1er du mois 00:00 UTC).
  // Sans ce cron, kill-switch global content-gen se déclenche après le 1er mois.
  if (costCapResetQueue) {
    await costCapResetQueue.removeRepeatable(
      "tick",
      { pattern: "0 0 1 * *" },
      "cost-cap-reset-cron",
    );
    await costCapResetQueue.add(
      "tick",
      { trigger: "cron-monthly-1st-0000", tick: new Date().toISOString() },
      { repeat: { pattern: "0 0 1 * *" }, jobId: "cost-cap-reset-cron" },
    );
  }

  // Observatoire IA 2026 — auto-update snapshot + analyse LLM toutes les 6 h.
  if (observatoireSnapshotQueue) {
    await observatoireSnapshotQueue.removeRepeatable(
      "tick",
      { pattern: "0 */6 * * *" },
      "observatoire-snapshot-cron",
    );
    await observatoireSnapshotQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 */6 * * *" }, jobId: "observatoire-snapshot-cron" },
    );
  }

  // Sprint Final 2026-05-22 — External links monthly HEAD check (1er du mois 02:00 UTC).
  // Gate EXTERNAL_LINKS_MONITOR_ENABLED=true côté worker (no-op sinon).
  if (externalLinksMonitorQueue) {
    await externalLinksMonitorQueue.removeRepeatable(
      "tick",
      { pattern: "0 2 1 * *" },
      "external-links-monitor-cron",
    );
    await externalLinksMonitorQueue.add(
      "tick",
      { trigger: "cron-monthly-1st-0200", tick: new Date().toISOString() },
      { repeat: { pattern: "0 2 1 * *" }, jobId: "external-links-monitor-cron" },
    );
  }

  // Sprint Site Explorer Admin 2026-05-22 — inspection URLs publiques daily 02:00 UTC.
  if (siteRouteInspectorQueue) {
    await siteRouteInspectorQueue.removeRepeatable(
      "tick",
      { pattern: "0 2 * * *" },
      "site-route-inspector-cron",
    );
    await siteRouteInspectorQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 2 * * *" }, jobId: "site-route-inspector-cron" },
    );
  }

  // Sprint Site Explorer Admin 2026-05-22 — détection anomalies daily 03:00 UTC.
  if (siteRouteAnomalyDetectorQueue) {
    await siteRouteAnomalyDetectorQueue.removeRepeatable(
      "tick",
      { pattern: "0 3 * * *" },
      "site-route-anomaly-detector-cron",
    );
    await siteRouteAnomalyDetectorQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 3 * * *" }, jobId: "site-route-anomaly-detector-cron" },
    );
  }

  // Onglet « Toutes les URLs » 2026-06-08 — découverte « vivante » daily 01:00 UTC
  // (avant l'inspecteur HTTP de 02:00, pour qu'il inspecte les URLs fraîchement
  // découvertes le jour même). Recalcule l'indexabilité live → bascule auto.
  if (siteRouteDiscoveryQueue) {
    await siteRouteDiscoveryQueue.removeRepeatable(
      "tick",
      { pattern: "0 1 * * *" },
      "site-route-discovery-cron",
    );
    await siteRouteDiscoveryQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 1 * * *" }, jobId: "site-route-discovery-cron" },
    );
  }

  // Onglet « Toutes les URLs » 2026-06-08 — trafic GSC par URL daily 04:00 UTC.
  if (siteRouteGscQueue) {
    await siteRouteGscQueue.removeRepeatable(
      "tick",
      { pattern: "0 4 * * *" },
      "site-route-gsc-cron",
    );
    await siteRouteGscQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "0 4 * * *" }, jobId: "site-route-gsc-cron" },
    );
  }

  // ============================================================
  // Qualiopi T6 — Formation crons (auto-transitions : date_debut + cloture_auto).
  // 2 jobs quotidiens 08:00 UTC (aligné sur le cron booking pour mutualiser
  // les périodes de faible charge). Séparés en 2 jobs distincts pour isolation
  // des erreurs (un job planifie→en_cours ne bloque pas le job en_cours→realisee).
  // ============================================================
  if (formationCronsQueue) {
    const formationCronSchedule: Array<{
      type: FormationCronJobType;
      pattern: string;
      jobId: string;
    }> = [
      {
        type: "formation-crons.date-debut",
        pattern: "0 8 * * *",
        jobId: "formation-crons-date-debut-cron",
      },
      {
        type: "formation-crons.cloture-auto",
        pattern: "0 8 * * *",
        jobId: "formation-crons-cloture-auto-cron",
      },
      {
        // T9 — génération automatique des attestations J+1 (sessions realisee)
        // Daily 09:00 UTC (décalé de 1h après cloture-auto 08:00 pour garantir J+1)
        type: "formation-crons.attestations-auto",
        pattern: "0 9 * * *",
        jobId: "formation-crons-attestations-auto-cron",
      },
      // T15 — rappels lifecycle email (daily 08:00 UTC)
      {
        type: "formation-crons.rappel-j7",
        pattern: "0 8 * * *",
        jobId: "formation-crons-rappel-j7-cron",
      },
      {
        type: "formation-crons.satisfaction-j1",
        pattern: "0 8 * * *",
        jobId: "formation-crons-satisfaction-j1-cron",
      },
      {
        type: "formation-crons.suivi-j30",
        pattern: "0 8 * * *",
        jobId: "formation-crons-suivi-j30-cron",
      },
      // Enquête ENTREPRISE J+30 (off.30, 2ᵉ source) — 08:15, après les envois
      // stagiaires de 08:00 pour ne pas mélanger les files.
      {
        type: "formation-crons.enquete-entreprise-j30",
        pattern: "15 8 * * *",
        jobId: "formation-crons-enquete-entreprise-j30-cron",
      },
      // Relances J+3/J+10 des questionnaires sans réponse — 08:30, APRÈS les
      // envois du jour : un questionnaire envoyé à 08:00 ne doit pas être
      // « relancé » dans la même passe.
      {
        type: "formation-crons.relance-questionnaires",
        pattern: "30 8 * * *",
        jobId: "formation-crons-relance-questionnaires-cron",
      },
      // T15 AGENT A — moteur d'alertes système (daily 07:00 UTC, avant les autres jobs)
      {
        type: "formation-crons.alertes",
        pattern: "0 7 * * *",
        jobId: "formation-crons-alertes-cron",
      },
      // T17 CLUSTER 3 — convocation réglementaire J-5 (off.9 Qualiopi).
      //
      // 🔴 HORAIRE, et non plus quotidien (2026-08-16). #612 avait retiré la
      // fenêtre basse : la sélection se fait par ÉTAT (`convocationEnvoyeeAt:
      // null`), donc une exécution manquée n'est plus définitive. Il restait
      // pourtant un trou que l'état ne pouvait pas combler — un trou de
      // CALENDRIER : une session créée le 15/08 à 14h51, après le passage de
      // 08:00 UTC, pour un début le 16/08 à 07h00, ne rencontre AUCUN passage
      // avant son propre démarrage. Vérifié sur AXI-SESS-2026-005 : #612 était
      // bien déployé, le cron a bien tourné, et rien n'est parti — parce qu'au
      // moment où il est passé la session n'existait pas encore.
      //
      // Passer à l'heure ramène ce trou de 24 h à moins d'une heure, et le fait
      // POUR TOUS LES CHEMINS de création — session créée par l'écran, par une
      // reprise, inscription ajoutée après coup, date avancée. Un déclencheur
      // posé à la création aurait dû être recopié à chacun de ces endroits, et
      // c'est précisément le genre de recopie qui diverge au premier oubli.
      //
      // Coût : 24 passages/jour d'une requête indexée qui ne ramène presque
      // jamais rien. Ce qu'il ne couvre toujours pas — une session créée moins
      // d'une heure avant son début — reste compté et journalisé comme écart
      // ind. 9 par `handleConvocationJ5`, parce qu'aucun envoi ne le répare.
      {
        type: "formation-crons.convocation-j5",
        pattern: "0 * * * *",
        jobId: "formation-crons-convocation-j5-cron",
      },
      // 2026-08-16 — liens de signature J-0, à 06:00 UTC (08:00 Paris l'été).
      //
      // AVANT le passage des alertes (07:00) : ainsi une session servie le matin
      // ne déclenche pas, une heure plus tard, l'alerte qui dit que personne ne
      // peut signer. L'ordre des crons est ici une règle, pas un détail — deux
      // passages inversés produiraient une alerte critique quotidienne sur des
      // sessions parfaitement en ordre, et une alerte qui crie à tort cesse
      // d'être lue.
      {
        type: "formation-crons.liens-emargement-j0",
        pattern: "0 6 * * *",
        jobId: "formation-crons-liens-emargement-j0-cron",
      },
      // Hub facturation Phase 3 — marquage retards (statut seul, AUCUN email),
      // daily 06:30 UTC (avant les alertes 07:00 pour qu'elles voient l'état à jour)
      {
        type: "formation-crons.factures-retard",
        pattern: "30 6 * * *",
        jobId: "formation-crons-factures-retard-cron",
      },
      // Hub facturation Phase 5 — brouillons des plans récurrents (émission
      // manuelle), daily 05:00 UTC
      {
        type: "formation-crons.plans-recurrents",
        pattern: "0 5 * * *",
        jobId: "formation-crons-plans-recurrents-cron",
      },
      // Parcours vente — expiration des devis à dateValidite (statut seul,
      // aucun email), daily 06:45 UTC : APRÈS factures-retard (06:30) et AVANT
      // le moteur d'alertes (07:00) pour que devis_expire voie l'état à jour.
      {
        type: "formation-crons.devis-expiration",
        pattern: "45 6 * * *",
        jobId: "formation-crons-devis-expiration-cron",
      },
      // Fraîcheur des offres d'emploi (Google for Jobs) — rappel Telegram des
      // offres à republier, hebdo lundi 08:15 UTC (après les crons du matin).
      {
        type: "formation-crons.offres-fraicheur",
        pattern: "15 8 * * 1",
        jobId: "formation-crons-offres-fraicheur-cron",
      },
      // Surveillance de la chaîne d'envoi (audit 2026-08-16) — HORAIRE, et non
      // quotidienne comme ses voisines. Une panne d'e-mails découverte le
      // lendemain matin, c'est une journée de convocations et d'attestations
      // perdue ; à l'heure, c'est un incident. `:20` pour ne pas tomber sur la
      // minute ronde où se pressent les autres files.
      {
        type: "formation-crons.email-sante",
        pattern: "20 * * * *",
        jobId: "formation-crons-email-sante-cron",
      },
    ];

    for (const { type, pattern, jobId } of formationCronSchedule) {
      await formationCronsQueue.removeRepeatable(type, { pattern }, jobId);
      await formationCronsQueue.add(
        type,
        { type, tick: new Date().toISOString() },
        { repeat: { pattern }, jobId },
      );
    }
  }

  // ── Entretien : restes Redis des 3 files legacy dormantes ─────────────────
  //
  // VOLONTAIREMENT EN DERNIER, apres la planification de TOUS les crons — en
  // particulier `retention-purge` (purge RGPD 03:00 UTC) et `formation-crons`.
  // `worker.ts` await `bootRepeatableJobs()` sans timeout : un Redis lent sur
  // ~6 000 cles ne doit jamais retarder l'enregistrement d'un cron d'obligation
  // legale. Ce fichier porte deja la cicatrice de ce bug — cf. le garde en tete
  // de fonction, qui ne depend plus que de `retentionPurgeQueue`. NE PAS le
  // rejouer en remontant ces appels dans les blocs legacy ci-dessus.
  //
  // Une seule passe pour `booking-crons`, hors de la boucle des 11 crons.
  if (!legacyBookingEnabled) {
    if (optionExpirationQueue) {
      await purgeDormantLegacyQueue(optionExpirationQueue, "option-expiration");
    }
    if (optionReminderQueue) {
      await purgeDormantLegacyQueue(optionReminderQueue, "option-reminder");
    }
    if (bookingCronsQueue) {
      await purgeDormantLegacyQueue(bookingCronsQueue, "booking-crons");
    }
  }
}
