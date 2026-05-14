/**
 * Sprint KB-19 V4 — Cron rétention KB (à scheduler quotidiennement à 03:00 UTC).
 *
 * Usage :
 *   pnpm tsx scripts/kb-retention-cron.ts --dry-run            (default)
 *   pnpm tsx scripts/kb-retention-cron.ts --commit
 *   pnpm tsx scripts/kb-retention-cron.ts --commit --keep-versions=10 --ingest-retention-days=60
 *
 * À wirer dans BullMQ scheduler ou cron OS (Coolify scheduled job).
 */

import { runRetentionPolicy } from "../src/lib/knowledge/retention-policy";
import { PrismaClient } from "../prisma/generated/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--commit");
  let keepLastVersions = 20;
  let ingestRequestRetentionDays = 90;

  for (const a of args) {
    if (a.startsWith("--keep-versions=")) keepLastVersions = parseInt(a.slice(16), 10);
    if (a.startsWith("--ingest-retention-days="))
      ingestRequestRetentionDays = parseInt(a.slice(24), 10);
  }

  console.log(
    `[kb-retention] mode=${dryRun ? "DRY-RUN" : "COMMIT"} keep-versions=${keepLastVersions} ingest-retention-days=${ingestRequestRetentionDays}`,
  );

  const report = await runRetentionPolicy({ dryRun, keepLastVersions, ingestRequestRetentionDays });

  console.log("[kb-retention] report =", JSON.stringify(report, null, 2));
  if (dryRun) {
    console.log(
      "[kb-retention] DRY-RUN — aucune écriture DB. Re-lancer avec --commit pour appliquer.",
    );
  } else {
    console.log("[kb-retention] purge appliquée.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
