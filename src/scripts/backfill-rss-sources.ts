/**
 * Script one-shot backfill RSS sources : ContentGenConfig JSON → Prisma rss_sources.
 *
 * Sprint v7 Phase 6 — à lancer manuellement en prod après deploy :
 *   pnpm tsx src/scripts/backfill-rss-sources.ts
 *
 * Idempotent : upsert par URL, ne réécrase pas les rows existantes.
 *
 * ⚠️ Auth : Le script bypasse `requireAdmin()` car exécuté localement avec
 * `DATABASE_URL` admin. Pour run prod, exporter `DATABASE_URL` du container
 * Coolify ou lancer dans le container : `docker exec axion-ia-app pnpm tsx ...`.
 */

import { PrismaClient } from "../../prisma/generated/client";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const raw = await prisma.contentGenConfig.findUnique({ where: { key: "rss_sources" } });
    if (!raw) {
      console.log("[backfill-rss-sources] No legacy ContentGenConfig.rss_sources — nothing to do.");
      return;
    }
    const legacy = Array.isArray(raw.value)
      ? (raw.value as ReadonlyArray<Record<string, unknown>>)
      : [];

    let inserted = 0;
    let skipped = 0;
    for (const src of legacy) {
      const url = typeof src.url === "string" ? src.url : null;
      if (!url) {
        skipped++;
        continue;
      }
      const existing = await prisma.rssSource.findUnique({ where: { url } });
      if (existing) {
        skipped++;
        console.log(`[backfill-rss-sources] SKIP (already exists): ${url}`);
        continue;
      }
      await prisma.rssSource.create({
        data: {
          url,
          name: typeof src.name === "string" ? src.name : "(sans nom)",
          enabled: typeof src.enabled === "boolean" ? src.enabled : true,
          verticale: null,
          tags: Array.isArray(src.tags) ? src.tags : [],
          pollIntervalMin: typeof src.pollIntervalMin === "number" ? src.pollIntervalMin : 60,
          autoPublish: typeof src.autoPublish === "boolean" ? src.autoPublish : false,
          language: "fr",
        },
      });
      inserted++;
      console.log(`[backfill-rss-sources] INSERT: ${url}`);
    }
    console.log(`[backfill-rss-sources] DONE — inserted=${inserted}, skipped=${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill-rss-sources] FAILED:", err);
  process.exit(1);
});
