/**
 * Chatbot ingest worker (T-05) — reconstruit l'index RAG chat_kb_chunks.
 *
 * Déclenché à la demande (console admin « relancer l'ingestion ») ou par cron.
 * Env-gated : ne démarre que si CHATBOT_ENABLED=true (réversible sans redeploy).
 * Chunking + embeddings Voyage (ou stub sans clé) → chat_kb_chunks (idempotent).
 */

import { Worker, type Job } from "bullmq";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { ingestAllSources, type IngestStats } from "@/server/chatbot/ingestion/ingest";

export const CHATBOT_INGEST_QUEUE = "chatbot-ingest";

async function runIngest(_job: Job): Promise<IngestStats> {
  const stats = await ingestAllSources();
  console.log(
    `[chatbot-ingest] ${stats.chunks} chunks depuis ${stats.sources} sources (${stats.durationMs} ms).`,
  );
  return stats;
}

let workerInstance: Worker | null = null;

export function startChatbotIngestWorker(): Worker {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — chatbot-ingest-worker cannot start");

  workerInstance = new Worker(CHATBOT_INGEST_QUEUE, runIngest, {
    connection: { url: redisUrl },
    concurrency: 1,
    lockDuration: 300_000, // ingestion longue (embeddings)
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 20 },
  });

  workerInstance.on("failed", (job, err) => {
    captureWorkerError("chatbot-ingest", CHATBOT_INGEST_QUEUE, job, err);
    console.error(`[chatbot-ingest-worker] job ${job?.id} failed:`, err);
  });

  return workerInstance;
}

export async function stopChatbotIngestWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}
