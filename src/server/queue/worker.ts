// Main worker entry (Sprint 15 / M8 step 4).
//
// Lance tous les workers BullMQ + boot les cron jobs recurrents.
// Run via `pnpm worker`. En production, tourner en process separe (Coolify
// service dedicated) pour isoler le throughput email du throughput web.

import { startEmailWorker } from "./workers/email-worker";
import { startOptionExpirationWorker } from "./workers/option-expiration-worker";
import { startOptionReminderWorker } from "./workers/option-reminder-worker";
import { bootRepeatableJobs } from "./queues";

async function main() {
  console.log("→ Axion-IA · BullMQ workers booting…");

  const workers = [startEmailWorker(), startOptionExpirationWorker(), startOptionReminderWorker()];

  await bootRepeatableJobs();

  console.log(`✓ ${workers.length} workers running. Cron jobs scheduled.`);

  // Graceful shutdown sur SIGTERM/SIGINT (Coolify, Ctrl+C dev)
  const shutdown = async (signal: string) => {
    console.log(`\n[worker] ${signal} received, closing…`);
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("✗ worker boot failed:", err);
  process.exit(1);
});
