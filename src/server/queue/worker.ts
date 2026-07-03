// Main worker entry (Sprint 15 / M8 step 4).
//
// Lance tous les workers BullMQ + boot les cron jobs recurrents.
// Run via `pnpm worker`. En production, tourner en process separe (Coolify
// service dedicated) pour isoler le throughput email du throughput web.

import { startEmailWorker } from "./workers/email-worker";
import { startOptionExpirationWorker } from "./workers/option-expiration-worker";
import { startOptionReminderWorker } from "./workers/option-reminder-worker";
import { startRetentionPurgeWorker } from "./workers/retention-purge-worker";
import { startBookingCronsWorker } from "./workers/booking-crons-worker";
import { startContentGenWorker } from "./workers/content-gen-worker";
import { startOrchestratorWorker } from "./workers/content-orchestrator-worker";
import { startQualityImproverWorker } from "./workers/content-quality-improver-worker";
import { startRssFetchWorker } from "./workers/content-rss-fetch-worker";
import { startSimilarityMonitorWorker } from "./workers/content-similarity-monitor-worker";
import { startNewsLifecycleWorker } from "./workers/content-news-lifecycle-worker";
import { startPublishWorker } from "./workers/content-publish-worker";
import { startIndexNowWorker } from "./workers/content-indexnow-worker";
import { startGoogleIndexingWorker } from "./workers/content-google-indexing-worker";
import { startContentQaExtractWorker } from "./workers/content-qa-extract-worker";
import { startTierLifecycleWorker } from "./workers/content-tier-lifecycle-worker";
import { startFactCheckWorker } from "./workers/content-fact-check-worker";
import { startKeywordSyncWorker } from "./workers/content-keyword-sync-worker";
import { startContentWebVitalsMonitorWorker } from "./workers/content-web-vitals-monitor-worker";
import { startContentPsiMonitorWorker } from "./workers/content-psi-monitor-worker";
import { startContentMonitoringWorker } from "./workers/content-monitoring-worker";
import { startContentWeeklyReportWorker } from "./workers/content-weekly-report-worker";
import { startContentGenSchedulerWorker } from "./workers/content-gen-scheduler-worker";
import { startContentDeadlineCheckerWorker } from "./workers/content-gen-deadline-checker";
import { startImageBankEnrichWorker } from "./workers/image-bank-enrich-worker";
import { startImageBankImportWorker } from "./workers/image-bank-import-worker";
import { startKitImportWorker } from "./workers/kit-import-worker";
import { startImageBankTranslateWorker } from "./workers/image-bank-translate-worker";
import { startImageBankCronsWorker } from "./workers/image-bank-crons-worker";
import { startImageBankAutoConvertWorker } from "./workers/image-bank-auto-convert-worker";
import { startEmbeddingsBackfillWorker } from "./workers/embeddings-backfill-worker";
import { startBrandVoiceDriftMonitorWorker } from "./workers/brand-voice-drift-monitor";
import { startKeywordOpportunityDetectorWorker } from "./workers/keyword-opportunity-detector";
// Sprint Final 2026-05-22 (P0-2 + P0-3 audit final) — 2 workers manquants au bootstrap.
import { startCostCapResetWorker } from "./workers/cost-cap-reset-worker";
import { startObservatoireSnapshotWorker } from "./workers/observatoire-snapshot-worker";
import { startExternalLinksMonitorWorker } from "./workers/external-links-monitor-worker";
// Sprint Site Explorer Admin 2026-05-22
import { startSiteRouteInspectorWorker } from "./workers/site-route-inspector-worker";
import { startSiteRouteAnomalyDetectorWorker } from "./workers/site-route-anomaly-detector-worker";
// Onglet « Toutes les URLs » 2026-06-08 — découverte « vivante » + trafic GSC
import { startSiteRouteDiscoveryWorker } from "./workers/site-route-discovery-worker";
import { startSiteRouteGscWorker } from "./workers/site-route-gsc-worker";
// Sprint v7 Phase 9 + Phase 13 — workers env-gated (throw si flag !=true).
// Démarrent uniquement si l'opérateur active explicitement le flag Coolify.
import { startGscHcuMonitorWorker } from "./workers/gsc-hcu-monitor-worker";
import { startContentRefreshWorker } from "./workers/content-refresh-worker";
// Qualiopi — Formation Engine T4 (génération IA pédagogique).
import { startFormationEngineWorker } from "./workers/qualiopi-formation-engine-worker";
// Qualiopi — Formation Crons T6 (auto-transitions session : planifiee→en_cours, en_cours→realisee).
import { startFormationCronsWorker } from "./workers/qualiopi-formation-crons-worker";
// Chatbot (T-05) — env-gated CHATBOT_ENABLED (réversible sans redeploy).
import { startChatbotIngestWorker } from "./workers/chatbot-ingest-worker";
import { bootRepeatableJobs } from "./queues";
import { isBullmqDisabled } from "./connection";
// Prospection & Base Entreprises (T3+) — workers + crons cloisonnés en module.
import { startProspectionStockIngestorWorker } from "./workers/prospection-stock-ingestor-worker";
import { startProspectionDeltaWorker } from "./workers/prospection-delta-worker";
import { startProspectionOrchestratorWorker } from "./workers/prospection-orchestrator-worker";
import { startProspectionCollectWorker } from "./workers/prospection-collect-worker";
import { startProspectionCoverageWorker } from "./workers/prospection-coverage-worker";
import { startProspectionSchedulerWorker } from "./workers/prospection-scheduler-worker";
import { startProspectionEnrichWorker } from "./workers/prospection-enrich-worker";
import { bootProspectionRepeatableJobs } from "@/server/prospection/queue/queues";

async function main() {
  if (isBullmqDisabled()) {
    console.warn("→ Axion-IA · BULLMQ_DISABLED=true, worker process aborting (intentional).");
    process.exit(0);
  }
  console.log("→ Axion-IA · BullMQ workers booting…");

  const workers = [
    startEmailWorker(),
    startOptionExpirationWorker(),
    startOptionReminderWorker(),
    startRetentionPurgeWorker(),
    startBookingCronsWorker(),
    // Content Generator V1 — 14 workers (§ 13 master prompt v1.7 + Pass B P0-7
    // + Sprints 9-12.5 V2 + Audit final P0-3 + Sprint S6.3 doc-sync P3-15)
    startContentGenWorker(),
    startOrchestratorWorker(),
    startQualityImproverWorker(),
    startRssFetchWorker(),
    startSimilarityMonitorWorker(),
    startNewsLifecycleWorker(),
    startPublishWorker(),
    startIndexNowWorker(),
    startGoogleIndexingWorker(),
    startContentQaExtractWorker(), // Pass B fix P0-7 — Q/R post-process § 29
    startTierLifecycleWorker(), // Sprint 10 V2 — mensuel 15 06:00 UTC
    startFactCheckWorker(), // Sprint 12.5 V2 — post-publish Perplexity claims
    startKeywordSyncWorker(), // Sprint 12.5 V2 — cron hebdo GSC/SerpAPI
    startContentWebVitalsMonitorWorker(), // Audit final P0-3 — daily 02:30 UTC
    startContentPsiMonitorWorker(), // P2-29 audit 2026-05-15 — weekly Mon 03:00 UTC
    startContentMonitoringWorker(), // Méta-cert 2026-05-15 AGENT 19 — hourly xx:15
    startContentWeeklyReportWorker(), // Sprint A D-P5-3 — lundi 7h00 UTC reporting KPI
    startContentGenSchedulerWorker(), // Sprint Campaign Controls C.2 — startDate → running (*/5 min)
    startContentDeadlineCheckerWorker(), // Sprint Campaign Controls C.3 — endDate auto-stop (00:05 UTC)
    // Image Bank V1 (Sprint 1-7 feat/image-bank-v1) — 5 workers
    // Patch post-audit 2026-05-16 P1-2 (activation prod). Sans QA staging
    // initial, désactivable par opérateur via BULLMQ_DISABLED=true.
    startImageBankEnrichWorker(),
    startImageBankImportWorker(),
    startKitImportWorker(), // import en masse kit formation (ZIP → documents-interventions)
    startImageBankTranslateWorker(),
    startImageBankCronsWorker(),
    startImageBankAutoConvertWorker(), // 2026-05-20 — conversion slug-based PNG→WebP/AVIF (public/images/)
    startEmbeddingsBackfillWorker(), // Phase F Sprint Perfection 2026 — daily 03:00 UTC embeddings backfill
    startBrandVoiceDriftMonitorWorker(), // Sprint H 2026-05-22 — daily 04:00 UTC brand voice drift detection
    startKeywordOpportunityDetectorWorker(), // Phase 8 Keywords Perfection 2026-05-22 — weekly lundi 06:00 UTC
    // Sprint Final 2026-05-22 (P0-2 + P0-3 audit final pré-prod)
    startCostCapResetWorker(), // P0-2 — Reset compteurs cost mensuel (1er du mois 00:00 UTC)
    startObservatoireSnapshotWorker(), // Observatoire — auto-update snapshot + analyse LLM toutes les 6 h
    // P0-3 — HEAD check liens externes (1er du mois 02:00 UTC). Env-gated comme
    // GSC/CONTENT_REFRESH/CHATBOT ci-dessous : startExternalLinksMonitorWorker()
    // THROW si EXTERNAL_LINKS_MONITOR_ENABLED!=true (external-links-monitor-worker.ts:368).
    // Sans ce spread conditionnel, un worker sans ce flag (ex. axion-ia-worker)
    // crashait tout le boot (donc AUCUN job, dont l'ingestion chatbot). Fix 2026-06-05.
    ...(process.env.EXTERNAL_LINKS_MONITOR_ENABLED === "true"
      ? [startExternalLinksMonitorWorker()]
      : []),
    // Sprint Site Explorer Admin 2026-05-22
    startSiteRouteInspectorWorker(), // daily 02:00 UTC — inspection URLs publiques
    startSiteRouteAnomalyDetectorWorker(), // daily 03:00 UTC — détection anomalies
    // Onglet « Toutes les URLs » 2026-06-08
    startSiteRouteDiscoveryWorker(), // daily 01:00 UTC — découverte « vivante » + indexabilité
    startSiteRouteGscWorker(), // daily 04:00 UTC — trafic GSC par URL
    // Sprint v7 Phase 9 + Phase 13 — workers env-gated.
    // Conditionnal spread : si flag !=true, le worker throw au start. On évite
    // le throw en n'appelant le constructeur que si le flag est true.
    ...(process.env.GSC_HCU_MONITOR_ENABLED === "true" ? [startGscHcuMonitorWorker()] : []),
    ...(process.env.CONTENT_REFRESH_ENABLED === "true" ? [startContentRefreshWorker()] : []),
    // Qualiopi Formation Engine T4 — génération IA pédagogique (toujours actif).
    startFormationEngineWorker(),
    // Qualiopi Formation Crons T6 — auto-transitions session (daily 08:00 UTC).
    startFormationCronsWorker(),
    // Chatbot ingest — démarre uniquement si le flag est explicitement activé.
    ...(process.env.CHATBOT_ENABLED === "true" ? [startChatbotIngestWorker()] : []),
    // Prospection & Base Entreprises (T3+) — ingestion Stock Sirene + delta.
    startProspectionStockIngestorWorker(),
    startProspectionDeltaWorker(),
    // Prospection T4 — orchestration campagne, collecte, coverage rollup, scheduler.
    startProspectionOrchestratorWorker(),
    startProspectionCollectWorker(),
    startProspectionCoverageWorker(),
    startProspectionSchedulerWorker(),
    // Prospection T5 — enrichissement 2 passes (site public + MX + responsables).
    startProspectionEnrichWorker(),
  ];

  await bootRepeatableJobs();
  await bootProspectionRepeatableJobs();

  console.log(`✓ ${workers.length} workers running. Cron jobs scheduled.`);

  // Graceful shutdown sur SIGTERM/SIGINT (Coolify, Ctrl+C dev).
  // Sprint 15 fix Fork 1 W3 : timeout drain explicite 25s (Coolify SIGKILL
  // a 30s par defaut — on garde 5s de marge).
  const shutdown = async (signal: string) => {
    console.log(`\n[worker] ${signal} received, draining (25s max)…`);
    const drainTimeout = new Promise<void>((resolve) => setTimeout(resolve, 25_000));
    const drainAll = Promise.all(workers.map((w) => w.close()));
    await Promise.race([drainAll, drainTimeout]);
    console.log("[worker] shutdown complete.");
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("✗ worker boot failed:", err);
  process.exit(1);
});
