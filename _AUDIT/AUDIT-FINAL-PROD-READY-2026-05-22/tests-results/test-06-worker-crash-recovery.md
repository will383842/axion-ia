# Test 06 — Worker crash recovery
## Date : 2026-05-22 — mode AUDIT-ONLY

## lockDuration + stalled handling
src/server/queue/workers/content-gen-worker.ts:703:    lockDuration: 120_000,
src/server/queue/workers/content-publish-worker.ts:716:    lockDuration: 120_000, // évite stall → double-ping IndexNow si opération réseau lente
src/server/queue/workers/content-quality-improver-worker.ts:352:    // P0-2 — lockDuration 2min : reviewArticle() (Claude Sonnet) peut dépasser 30s.
src/server/queue/workers/content-quality-improver-worker.ts:353:    // Sans lockDuration, BullMQ marque le job stalled → double review possible.
src/server/queue/workers/content-quality-improver-worker.ts:354:    lockDuration: 120_000,

## Retry policy + backoff

## captureWorkerError
src/server/queue/workers/brand-voice-drift-monitor.ts:25:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/brand-voice-drift-monitor.ts:276:    captureWorkerError("brand-voice-drift-monitor", QUEUE_NAME, job, err);
src/server/queue/workers/content-gen-deadline-checker.ts:16:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-gen-deadline-checker.ts:146:    captureWorkerError("content-gen-deadline-checker", QUEUE_NAME, job, err);
src/server/queue/workers/content-gen-scheduler-worker.ts:16:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-gen-scheduler-worker.ts:61:    captureWorkerError("content-gen-scheduler", QUEUE_NAME, job, err);
src/server/queue/workers/content-gen-worker.ts:35:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-gen-worker.ts:722:      captureWorkerError("gen", QUEUE_NAME, job, err);
src/server/queue/workers/content-indexnow-worker.ts:24:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-indexnow-worker.ts:163:    captureWorkerError("indexnow", QUEUE_NAME, job, err);
src/server/queue/workers/content-orchestrator-worker.ts:27:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-orchestrator-worker.ts:530:    captureWorkerError("orchestrator", QUEUE_NAME, job, err);
src/server/queue/workers/content-publish-worker.ts:36:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-publish-worker.ts:225:    captureWorkerError("publish", QUEUE_NAME, undefined, new Error(errMsg));
src/server/queue/workers/content-publish-worker.ts:733:      captureWorkerError("publish", QUEUE_NAME, job, err);
src/server/queue/workers/content-quality-improver-worker.ts:26:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-quality-improver-worker.ts:361:    captureWorkerError("quality-improver", QUEUE_NAME, job, err);
src/server/queue/workers/content-weekly-report-worker.ts:19:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
src/server/queue/workers/content-weekly-report-worker.ts:177:    captureWorkerError("weekly-report", QUEUE_NAME, job, err);
src/server/queue/workers/embeddings-backfill-worker.ts:24:import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
