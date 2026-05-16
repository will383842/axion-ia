/**
 * Backfill `ip_hash` à partir de `ip_address` pour Submission +
 * NewsletterSubscriber (Sprint Correctif S+1 P0-S1-3 RGPD 2026-05-16).
 *
 * Exécution :
 *   ```bash
 *   IP_HASH_SALT=<salt-prod-32+chars> pnpm tsx prisma/scripts/backfill-ip-hash-2026-05-16.ts
 *   ```
 *
 * Le salt DOIT être identique en dev et en prod (sinon les hashes diffèrent
 * et la dedup anti-fraude inter-environnement casse).
 *
 * Idempotent : skip les lignes où `ip_hash` est déjà set OU `ip_address` est null.
 * Batch 1000 rows par UPDATE pour limiter le verrouillage.
 *
 * Après exécution, vérifier :
 *   - SELECT COUNT(*) FROM submissions WHERE ip_address IS NOT NULL AND ip_hash IS NULL; → 0
 *   - SELECT COUNT(*) FROM newsletter_subscribers WHERE ip_address IS NOT NULL AND ip_hash IS NULL; → 0
 *
 * Puis S+2 : migration DROP COLUMN ip_address sur les 2 tables.
 */

import { PrismaClient } from "../generated/client";
import { hashIp } from "../../src/lib/security/ip-hash";

const prisma = new PrismaClient();
const BATCH = 1000;

async function backfillTable(table: "submission" | "newsletterSubscriber"): Promise<number> {
  let processed = 0;
  let offset = 0;
  // Cast escape-hatch — TS strict ne déduit pas l'union via index dynamique.
  const delegate = (
    prisma as unknown as Record<
      string,
      {
        findMany: (a: unknown) => Promise<Array<{ id: string; ipAddress: string | null }>>;
        update: (a: unknown) => Promise<unknown>;
      }
    >
  )[table];
  if (!delegate) throw new Error(`Unknown table delegate ${table}`);
  while (true) {
    const rows = await delegate.findMany({
      where: { ipAddress: { not: null }, ipHash: null },
      select: { id: true, ipAddress: true },
      take: BATCH,
      skip: offset,
      orderBy: { id: "asc" },
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      const hash = hashIp(row.ipAddress);
      if (!hash) continue;
      await delegate.update({
        where: { id: row.id },
        data: { ipHash: hash },
      });
      processed++;
    }
    offset += rows.length;
    console.log(`[backfill-ip-hash] ${table} : ${processed} rows mis à jour (offset ${offset})`);
  }
  return processed;
}

async function main(): Promise<void> {
  if (!process.env.IP_HASH_SALT || process.env.IP_HASH_SALT.length < 32) {
    throw new Error("IP_HASH_SALT manquant ou < 32 chars — abort.");
  }
  console.log("[backfill-ip-hash] Démarrage backfill Submission + NewsletterSubscriber");
  const sub = await backfillTable("submission");
  const news = await backfillTable("newsletterSubscriber");
  console.log(`[backfill-ip-hash] DONE — submissions: ${sub}, newsletter: ${news}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
