#!/usr/bin/env tsx
/**
 * Échantillonne 5 villes par tier × status pour test manuel (Will 2026-05-26).
 */
import { PrismaClient } from "../prisma/generated/client";
import { VILLES, type Ville } from "../src/content/villes";

type Tier = 1 | 2 | 3 | 4;
function classifyTier(p: number): Tier {
  if (p >= 500_000) return 1;
  if (p >= 100_000) return 2;
  if (p >= 20_000) return 3;
  return 4;
}

async function main() {
  const p = new PrismaClient();
  try {
    const approved = await p.generatedVilleCopy.findMany({
      where: { status: "approved" },
      select: { villeSlug: true, qualityScore: true },
    });
    const approvedSlugs = new Set(approved.map((r) => r.villeSlug));

    const byTier: Record<Tier, { tsCopy: Ville[]; dbApproved: Ville[]; stub: Ville[] }> = {
      1: { tsCopy: [], dbApproved: [], stub: [] },
      2: { tsCopy: [], dbApproved: [], stub: [] },
      3: { tsCopy: [], dbApproved: [], stub: [] },
      4: { tsCopy: [], dbApproved: [], stub: [] },
    };

    for (const v of VILLES) {
      const tier = classifyTier(v.population);
      if (v.copy) byTier[tier].tsCopy.push(v);
      else if (approvedSlugs.has(v.slug)) byTier[tier].dbApproved.push(v);
      else byTier[tier].stub.push(v);
    }

    console.log("\n=== Échantillons URLs à tester (3 par catégorie) ===\n");
    for (const tier of [1, 2, 3] as Tier[]) {
      console.log(`--- TIER ${tier} ---`);
      const ts = byTier[tier].tsCopy.slice(0, 3);
      const db = byTier[tier].dbApproved.slice(0, 3);
      const stub = byTier[tier].stub.slice(0, 3);

      if (ts.length > 0) {
        console.log(`  TS file (hub riche) :`);
        for (const v of ts) {
          console.log(`    https://axion-ia.com/fr/implantations/${v.region}/${v.slug}`);
        }
      }
      if (db.length > 0) {
        console.log(`  DB approved (hub riche) :`);
        for (const v of db) {
          console.log(`    https://axion-ia.com/fr/implantations/${v.region}/${v.slug}`);
        }
      }
      if (stub.length > 0) {
        console.log(`  Stub noindex (PAS de 5 cards) :`);
        for (const v of stub) {
          console.log(`    https://axion-ia.com/fr/implantations/${v.region}/${v.slug}`);
        }
      }
      console.log("");
    }
  } finally {
    await p.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
