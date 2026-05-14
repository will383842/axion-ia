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
