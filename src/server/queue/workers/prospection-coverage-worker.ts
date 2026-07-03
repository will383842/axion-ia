/**
 * Worker — Rollup de couverture (prospection T4).
 *
 * Recalcule `GeoCoverageStat` (dép→région→France) depuis un COUNT réel
 * (anti-dérive) + écrit le snapshot du jour. Stub-aware. Détection d'anomalies
 * détaillée = T9.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { rebuildGeoCoverage, type CoverageDb } from "@/server/prospection/collect/coverage-service";
import { dimKey } from "@/server/prospection/collect/coverage-rollup";
import { isBuildStub } from "@/server/prospection/sources/stock-source";
import type { ProspectionCoverageJobData } from "@/server/prospection/queue/queues";
import type { Job } from "bullmq";

const QUEUE_NAME = "prospection-coverage";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6381";
let workerInstance: Worker<ProspectionCoverageJobData> | null = null;

function midnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function processJob(_job: Job<ProspectionCoverageJobData>) {
  if (isBuildStub()) return { skipped: "stub" as const };
  const today = midnight(new Date());
  const stats = await rebuildGeoCoverage(prisma as unknown as CoverageDb, {
    snapshotDate: new Date(),
  });

  // Snapshot quotidien par scope (courbes / débit / ETA — évite de scanner les events).
  for (const s of stats) {
    await prisma.prospectionStatsSnapshot.upsert({
      where: {
        date_scope_scopeId_dimKey: {
          date: today,
          scope: s.scope,
          scopeId: s.scopeId,
          dimKey: dimKey(),
        },
      },
      create: {
        date: today,
        scope: s.scope,
        scopeId: s.scopeId,
        dimKey: dimKey(),
        stockAttendu: s.stockAttendu,
        collectees: s.collectees,
        enrichies: s.enrichies,
        exploitables: s.exploitables,
        partiels: s.partiels,
        nonContactables: s.nonContactables,
      },
      update: {
        stockAttendu: s.stockAttendu,
        collectees: s.collectees,
        enrichies: s.enrichies,
        exploitables: s.exploitables,
        partiels: s.partiels,
        nonContactables: s.nonContactables,
      },
    });
  }
  return { scopes: stats.length };
}

export function startProspectionCoverageWorker(): Worker<ProspectionCoverageJobData> {
  if (workerInstance) return workerInstance;
  workerInstance = new Worker<ProspectionCoverageJobData>(QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 600_000,
  });
  workerInstance.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] job ${job?.id} failed:`, err);
    captureWorkerError("prospection-coverage", QUEUE_NAME, job, err);
  });
  return workerInstance;
}
