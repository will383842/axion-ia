/**
 * Prospection — Registre des files BullMQ du module (T3+).
 *
 * Déclaré EN MODULE (cloisonnement) : réutilise la connexion partagée
 * (`getBullConnection`) sans toucher au gros `src/server/queue/queues.ts`. Les
 * Server Actions et workers enqueue via les helpers exportés ici. Toutes les
 * files sont `Queue | null` (no-op propre si `BULLMQ_DISABLED`).
 */

import { Queue } from "bullmq";
import { getBullConnection, isBullmqDisabled } from "@/server/queue/connection";

const connection = getBullConnection();

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
  removeOnFail: { age: 30 * 24 * 3600, count: 5000 },
};

// --- Types de jobs ---
export interface ProspectionStockIngestJobData {
  runId?: string;
  uniteLegalePath?: string;
  etablissementPath?: string;
}
export interface ProspectionDeltaJobData {
  tick: string;
  deltaPath?: string;
}
export interface ProspectionOrchestratorJobData {
  campaignId: string;
}
export interface ProspectionCollectJobData {
  cellId: string;
  runId: string;
}
export interface ProspectionEnrichJobData {
  companyId: string;
}
export interface ProspectionCoverageJobData {
  campaignId?: string;
  tick?: string;
}
export interface ProspectionExportJobData {
  exportId: string;
}
export interface ProspectionSchedulerJobData {
  tick: string;
}
export interface ProspectionAnnuaireSanteJobData {
  rppsPath?: string;
}

// --- Files ---
export const prospectionStockIngestorQueue: Queue<ProspectionStockIngestJobData> | null = connection
  ? new Queue<ProspectionStockIngestJobData>("prospection-stock-ingestor", {
      connection,
      defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
    })
  : null;

export const prospectionDeltaQueue: Queue<ProspectionDeltaJobData> | null = connection
  ? new Queue<ProspectionDeltaJobData>("prospection-delta", { connection, defaultJobOptions })
  : null;

export const prospectionOrchestratorQueue: Queue<ProspectionOrchestratorJobData> | null = connection
  ? new Queue<ProspectionOrchestratorJobData>("prospection-orchestrator", {
      connection,
      defaultJobOptions,
    })
  : null;

export const prospectionCollectQueue: Queue<ProspectionCollectJobData> | null = connection
  ? new Queue<ProspectionCollectJobData>("prospection-collect", {
      connection,
      // Le garde-fou DUR du rate-limit est le `limiter:{max,duration}` posé sur
      // le WORKER collect (T4, pattern content-fact-check-worker), pas sur la Queue.
      // Le token-bucket Redis (resilience/) lisse la limite globale par-source.
      defaultJobOptions,
    })
  : null;

export const prospectionEnrichQueue: Queue<ProspectionEnrichJobData> | null = connection
  ? new Queue<ProspectionEnrichJobData>("prospection-enrich", { connection, defaultJobOptions })
  : null;

export const prospectionCoverageQueue: Queue<ProspectionCoverageJobData> | null = connection
  ? new Queue<ProspectionCoverageJobData>("prospection-coverage", { connection, defaultJobOptions })
  : null;

export const prospectionExportQueue: Queue<ProspectionExportJobData> | null = connection
  ? new Queue<ProspectionExportJobData>("prospection-export", { connection, defaultJobOptions })
  : null;

export const prospectionSchedulerQueue: Queue<ProspectionSchedulerJobData> | null = connection
  ? new Queue<ProspectionSchedulerJobData>("prospection-scheduler", {
      connection,
      defaultJobOptions,
    })
  : null;

export const prospectionAnnuaireSanteQueue: Queue<ProspectionAnnuaireSanteJobData> | null =
  connection
    ? new Queue<ProspectionAnnuaireSanteJobData>("prospection-annuaire-sante", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
      })
    : null;

function warnNoConnection(fn: string): void {
  if (process.env.NODE_ENV !== "production" && !isBullmqDisabled()) {
    console.warn(`[bullmq] no connection, skipping ${fn}`);
  }
}

// --- Helpers d'enqueue ---
export async function enqueueProspectionStockIngest(
  data: ProspectionStockIngestJobData = {},
): Promise<void> {
  if (!prospectionStockIngestorQueue) return warnNoConnection("enqueueProspectionStockIngest");
  const runId = data.runId ?? `stock-${data.uniteLegalePath ?? "adhoc"}`;
  await prospectionStockIngestorQueue.add("ingest", data, { jobId: `prospection-stock-${runId}` });
}

export async function enqueueProspectionAnnuaireSante(
  data: ProspectionAnnuaireSanteJobData = {},
): Promise<void> {
  if (!prospectionAnnuaireSanteQueue) return warnNoConnection("enqueueProspectionAnnuaireSante");
  await prospectionAnnuaireSanteQueue.add("ingest", data, { jobId: "prospection-annuaire-sante" });
}

export async function enqueueProspectionOrchestrator(campaignId: string): Promise<void> {
  if (!prospectionOrchestratorQueue) return warnNoConnection("enqueueProspectionOrchestrator");
  // PAS de jobId stable : la ré-orchestration (reprise après erreur / récurrence
  // T6) doit TOUJOURS créer un nouveau run (sinon no-op BullMQ sur job complété).
  // L'orchestrateur est idempotent (upsert cellules) → un run en double est sûr.
  await prospectionOrchestratorQueue.add("orchestrate", { campaignId });
}

export async function enqueueProspectionCollect(cellId: string, runId: string): Promise<void> {
  if (!prospectionCollectQueue) return warnNoConnection("enqueueProspectionCollect");
  // jobId à nonce d'attempt (runId) → évite le no-op BullMQ sur jobId réutilisé.
  await prospectionCollectQueue.add(
    "collect",
    { cellId, runId },
    { jobId: `prospection-collect-${cellId}-${runId}` },
  );
}

export async function enqueueProspectionEnrich(companyId: string): Promise<void> {
  if (!prospectionEnrichQueue) return warnNoConnection("enqueueProspectionEnrich");
  await prospectionEnrichQueue.add(
    "enrich",
    { companyId },
    { jobId: `prospection-enrich-${companyId}` },
  );
}

export async function enqueueProspectionCoverage(campaignId?: string): Promise<void> {
  if (!prospectionCoverageQueue) return warnNoConnection("enqueueProspectionCoverage");
  const tick = new Date().toISOString();
  await prospectionCoverageQueue.add("coverage", campaignId ? { campaignId, tick } : { tick });
}

export async function enqueueProspectionExport(exportId: string): Promise<void> {
  if (!prospectionExportQueue) return warnNoConnection("enqueueProspectionExport");
  await prospectionExportQueue.add(
    "export",
    { exportId },
    { jobId: `prospection-export-${exportId}` },
  );
}

/**
 * Enregistre les jobs récurrents du module. Étendu par tranche :
 *  - T3 : delta quotidien.
 *  - T4/T6 : scheduler `*​/5`, coverage rollup horaire.
 */
export async function bootProspectionRepeatableJobs(): Promise<void> {
  if (!prospectionDeltaQueue) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[bullmq] no connection, skipping bootProspectionRepeatableJobs");
    }
    return;
  }
  // Delta Sirene quotidien 04:30 UTC (no-op si aucun fichier delta configuré).
  await prospectionDeltaQueue.removeRepeatable(
    "tick",
    { pattern: "30 4 * * *" },
    "prospection-delta-cron",
  );
  await prospectionDeltaQueue.add(
    "tick",
    { tick: new Date().toISOString() },
    { repeat: { pattern: "30 4 * * *" }, jobId: "prospection-delta-cron" },
  );

  // Scheduler campagnes toutes les 5 min (active les campagnes dues).
  if (prospectionSchedulerQueue) {
    await prospectionSchedulerQueue.removeRepeatable(
      "tick",
      { pattern: "*/5 * * * *" },
      "prospection-scheduler-cron",
    );
    await prospectionSchedulerQueue.add(
      "tick",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "*/5 * * * *" }, jobId: "prospection-scheduler-cron" },
    );
  }

  // Rollup de couverture horaire (dép→région→France + snapshot du jour).
  if (prospectionCoverageQueue) {
    await prospectionCoverageQueue.removeRepeatable(
      "coverage",
      { pattern: "15 * * * *" },
      "prospection-coverage-cron",
    );
    await prospectionCoverageQueue.add(
      "coverage",
      { tick: new Date().toISOString() },
      { repeat: { pattern: "15 * * * *" }, jobId: "prospection-coverage-cron" },
    );
  }
}
