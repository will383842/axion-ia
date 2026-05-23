/**
 * Seed `CityGenerationOrder` — file globale 2150 villes triée par population DESC.
 *
 * Sprint v7 Phase 1 commit 2.
 *
 * Idempotent : upsert par villeSlug. **Préserve pinned/pinnedAt** lors d'un
 * re-seed (Will peut pinner manuellement des villes en tête de file — ne pas
 * écraser ces choix). Met à jour rank/regionSlug/deptCode/tier/pop.
 *
 * Tier classification (convention INSEE-like par population) :
 *   - T1 : > 500 000 hab. (Paris, Marseille, Lyon, Toulouse)
 *   - T2 : 100 000 – 500 000 (grandes villes ~40)
 *   - T3 : 20 000 – 100 000 (moyennes ~400)
 *   - T4 : < 20 000 (petites ~1700)
 *
 * Usage :
 *   pnpm db:seed:cities-order
 *   # ou directement
 *   tsx scripts/seed-city-generation-order.ts
 *
 * Pré-requis :
 *   - DATABASE_URL pointe sur la DB cible (local ou prod via env)
 *   - Migration `20260523123842_add_city_generation_order_v7_phase1` appliquée
 */

import { PrismaClient } from "@prisma/client";

import { VILLES } from "../src/content/villes";

const prisma = new PrismaClient();

function classifyTier(population: number): "T1" | "T2" | "T3" | "T4" {
  if (population > 500_000) return "T1";
  if (population >= 100_000) return "T2";
  if (population >= 20_000) return "T3";
  return "T4";
}

async function main(): Promise<void> {
  // Trie par population DESC pour rank initial.
  const sorted = [...VILLES].sort((a, b) => b.population - a.population);

  console.log(`[seed-city-generation-order] ${sorted.length} villes à upsert (pop DESC)`);

  let createdCount = 0;
  let updatedCount = 0;
  let pinnedPreserved = 0;

  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    if (!v) continue; // narrow noUncheckedIndexedAccess
    const rank = i + 1;
    const tier = classifyTier(v.population);

    // Pré-check pour distinguer create vs update (et logger les pinned préservés)
    const existing = await prisma.cityGenerationOrder.findUnique({
      where: { villeSlug: v.slug },
      select: { pinned: true },
    });

    await prisma.cityGenerationOrder.upsert({
      where: { villeSlug: v.slug },
      create: {
        villeSlug: v.slug,
        rank,
        pinned: false,
        pinnedAt: null,
        regionSlug: v.region,
        deptCode: v.departement,
        tier,
        pop: v.population,
      },
      // UPDATE volontairement SANS pinned/pinnedAt — preserve choix manuel Will.
      update: {
        rank,
        regionSlug: v.region,
        deptCode: v.departement,
        tier,
        pop: v.population,
      },
    });

    if (existing) {
      updatedCount += 1;
      if (existing.pinned) pinnedPreserved += 1;
    } else {
      createdCount += 1;
    }

    if ((i + 1) % 200 === 0) {
      console.log(`  …${i + 1}/${sorted.length} upserted`);
    }
  }

  console.log(`[seed-city-generation-order] DONE`);
  console.log(`  created:   ${createdCount}`);
  console.log(`  updated:   ${updatedCount}`);
  console.log(`  pinned preserved: ${pinnedPreserved}`);
}

main()
  .catch((err) => {
    console.error("[seed-city-generation-order] ERROR:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
