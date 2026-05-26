#!/usr/bin/env tsx
/**
 * Stats VilleCopy — état exact T1/T2/T3/T4 (Will 2026-05-26).
 *
 * Sortie : tableau croisé tier × status pour comprendre exactement où en est
 * le scaling des hub villes (5 cards + indexable Google).
 *
 * Sources de copy :
 *   - Tier-1 manuel : src/content/villes/copy/<slug>.ts (41 fichiers)
 *   - Tier-2/3/4 LLM : table DB `GeneratedVilleCopy` (status approved/draft/review_required)
 *
 * Usage : pnpm tsx scripts/stats-villes-copy.ts
 */

import { PrismaClient } from "../prisma/generated/client";
import { VILLES } from "../src/content/villes";

type Tier = 1 | 2 | 3 | 4;

function classifyTier(population: number): Tier {
  if (population >= 500_000) return 1;
  if (population >= 100_000) return 2;
  if (population >= 20_000) return 3;
  return 4;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1. Toutes les villes par tier
    const totalByTier: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const tsCopyByTier: Record<Tier, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const villeBySlug = new Map<string, { tier: Tier; hasTsCopy: boolean }>();

    for (const v of VILLES) {
      const tier = classifyTier(v.population);
      totalByTier[tier]++;
      if (v.copy) tsCopyByTier[tier]++;
      villeBySlug.set(v.slug, { tier, hasTsCopy: !!v.copy });
    }

    // 2. Rows DB GeneratedVilleCopy
    const dbRows = await prisma.generatedVilleCopy.findMany({
      select: { villeSlug: true, status: true, qualityScore: true },
    });

    // Status × tier
    const dbByTierStatus: Record<Tier, Record<string, number>> = {
      1: {},
      2: {},
      3: {},
      4: {},
    };
    let dbOrphans = 0; // rows DB pour villes inconnues
    for (const row of dbRows) {
      const meta = villeBySlug.get(row.villeSlug);
      if (!meta) {
        dbOrphans++;
        continue;
      }
      dbByTierStatus[meta.tier][row.status] = (dbByTierStatus[meta.tier][row.status] ?? 0) + 1;
    }

    // 3. Affichage tableau
    console.log("\n========================================================");
    console.log("STATS VILLES COPY — Tier × Source (TS file + DB status)");
    console.log("========================================================\n");
    console.log("Total villes dataset : " + VILLES.length);
    console.log("Total rows DB GeneratedVilleCopy : " + dbRows.length);
    if (dbOrphans > 0) console.log("⚠️  Rows DB orphelines (slug inconnu) : " + dbOrphans);
    console.log("");
    console.log(
      "Tier | Population      | Total | TS file | DB approved | DB draft | DB review | DB autres | SANS copy (stub)",
    );
    console.log(
      "-----|-----------------|-------|---------|-------------|----------|-----------|-----------|------------------",
    );
    for (const tier of [1, 2, 3, 4] as Tier[]) {
      const total = totalByTier[tier];
      const tsCount = tsCopyByTier[tier];
      const approved = dbByTierStatus[tier]["approved"] ?? 0;
      const generated = dbByTierStatus[tier]["generated"] ?? 0;
      const rejected = dbByTierStatus[tier]["rejected"] ?? 0;
      const quarantined = dbByTierStatus[tier]["quarantined"] ?? 0;
      const otherStatuses = quarantined;
      const draft = generated;
      const review = rejected;
      // Villes avec ZÉRO copy (ni TS ni DB) = stub noindex
      const withAnyCopy = tsCount + approved + draft + review + otherStatuses;
      const stub = Math.max(0, total - withAnyCopy);
      const popRange =
        tier === 1
          ? ">= 500 000"
          : tier === 2
            ? "100k - 500k"
            : tier === 3
              ? "20k - 100k"
              : "< 20k";
      console.log(
        `T${tier}   | ${popRange.padEnd(15)} | ${String(total).padStart(5)} | ${String(tsCount).padStart(7)} | ${String(approved).padStart(11)} | ${String(draft).padStart(8)} | ${String(review).padStart(9)} | ${String(otherStatuses).padStart(9)} | ${String(stub).padStart(16)}`,
      );
    }
    console.log("");

    // 4. Récap actionnable
    const totalT3 = totalByTier[3];
    const t3Indexable = (tsCopyByTier[3] ?? 0) + (dbByTierStatus[3]["approved"] ?? 0);
    const t3Pending = (dbByTierStatus[3]["generated"] ?? 0) + (dbByTierStatus[3]["rejected"] ?? 0);
    const t3Missing = totalT3 - t3Indexable - t3Pending;
    console.log("========================================================");
    console.log("RÉCAP T3 (villes 20k-100k habitants)");
    console.log("========================================================");
    console.log(`Total T3 : ${totalT3} villes`);
    console.log(`  ✅ Indexable (TS ou DB approved) : ${t3Indexable}`);
    console.log(`  ⏳ En attente approve (draft/review) : ${t3Pending}`);
    console.log(`  ❌ Sans copy (stub noindex) : ${t3Missing}`);
    console.log("");

    if (t3Pending > 0) {
      console.log(`→ Action 1 : approve les ${t3Pending} drafts qualifiés`);
      console.log("    Bump --auto-approve-threshold ou approve manuel via admin UI");
    }
    if (t3Missing > 0) {
      console.log(`→ Action 2 : generate les ${t3Missing} villes T3 sans copy`);
      console.log("    pnpm tsx scripts/regen-villes-complete.ts --tier=3");
      console.log(`    Coût estimé : ${(t3Missing * 0.05).toFixed(2)}$ USD`);
    }

    // 5. Quality score distribution (drafts only, pour décider du threshold)
    const t3Drafts = dbRows.filter((r) => {
      const meta = villeBySlug.get(r.villeSlug);
      return meta?.tier === 3 && r.status === "generated";
    });
    if (t3Drafts.length > 0) {
      const scores = t3Drafts.map((r) => r.qualityScore ?? 0);
      const sorted = [...scores].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p25 = sorted[Math.floor(sorted.length * 0.25)];
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      const above70 = scores.filter((s) => s >= 70).length;
      const above80 = scores.filter((s) => s >= 80).length;
      console.log("");
      console.log("Quality scores T3 drafts :");
      console.log(
        `  Min/p25/median/p75/max : ${sorted[0]} / ${p25} / ${median} / ${p75} / ${sorted[sorted.length - 1]}`,
      );
      console.log(`  Drafts T3 avec score >= 70 (auto-approvable) : ${above70}`);
      console.log(`  Drafts T3 avec score >= 80 (haute qualité) : ${above80}`);
    }
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[stats-villes-copy] error:", err);
  process.exit(1);
});
