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
import { startImageBankEnrichWorker } from "./workers/image-bank-enrich-worker";
import { startImageBankImportWorker } from "./workers/image-bank-import-worker";
import { startImageBankTranslateWorker } from "./workers/image-bank-translate-worker";
import { startImageBankCronsWorker } from "./workers/image-bank-crons-worker";
import { startImageBankAutoConvertWorker } from "./workers/image-bank-auto-convert-worker";
import { bootRepeatableJobs } from "./queues";
import { isBullmqDisabled } from "./connection";

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
    // Image Bank V1 (Sprint 1-7 feat/image-bank-v1) — 5 workers
    // Patch post-audit 2026-05-16 P1-2 (activation prod). Sans QA staging
    // initial, désactivable par opérateur via BULLMQ_DISABLED=true.
    startImageBankEnrichWorker(),
    startImageBankImportWorker(),
    startImageBankTranslateWorker(),
    startImageBankCronsWorker(),
    startImageBankAutoConvertWorker(), // 2026-05-20 — conversion slug-based PNG→WebP/AVIF (public/images/)
  ];

  await bootRepeatableJobs();

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
