#!/usr/bin/env tsx
import { PrismaClient } from "../prisma/generated/client";

async function main() {
  const p = new PrismaClient();
  try {
    // Détail des 5 generated T3 (low quality)
    const generated = await p.generatedVilleCopy.findMany({
      where: { status: "generated" },
      select: {
        villeSlug: true,
        status: true,
        qualityScore: true,
        modelUsed: true,
        updatedAt: true,
        totalCostUsd: true,
      },
      orderBy: { qualityScore: "asc" },
    });
    console.log("=== 5 generated drafts (en attente approve) ===");
    for (const r of generated) {
      const cost = r.totalCostUsd ? Number(r.totalCostUsd) : 0;
      console.log(
        `  ${r.villeSlug.padEnd(30)} | score=${r.qualityScore} | model=${r.modelUsed} | cost=$${cost.toFixed(3)} | updated=${r.updatedAt.toISOString().slice(0, 10)}`,
      );
    }

    // Total cost déjà engagé
    const allRows = await p.generatedVilleCopy.findMany({
      select: { totalCostUsd: true, status: true },
    });
    const totalCost = allRows.reduce(
      (sum, r) => sum + (r.totalCostUsd ? Number(r.totalCostUsd) : 0),
      0,
    );
    const approvedCost = allRows
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + (r.totalCostUsd ? Number(r.totalCostUsd) : 0), 0);
    console.log("\n=== Coût LLM déjà engagé ===");
    console.log(`  Total tous statuts : $${totalCost.toFixed(2)}`);
    console.log(`  Total approved : $${approvedCost.toFixed(2)}`);

    // Sample des 59 approved T3 — distribution qualité
    const t3Approved = await p.generatedVilleCopy.findMany({
      where: { status: "approved" },
      select: { villeSlug: true, qualityScore: true },
      orderBy: { qualityScore: "asc" },
    });
    if (t3Approved.length > 0) {
      const scores = t3Approved.map((r) => r.qualityScore ?? 0);
      const sorted = [...scores].sort((a, b) => a - b);
      console.log("\n=== Quality scores approved (tous tiers) ===");
      console.log(
        `  Min/p25/median/p75/max : ${sorted[0]} / ${sorted[Math.floor(sorted.length * 0.25)]} / ${sorted[Math.floor(sorted.length / 2)]} / ${sorted[Math.floor(sorted.length * 0.75)]} / ${sorted[sorted.length - 1]}`,
      );
      console.log(`  Total approved : ${t3Approved.length}`);
      console.log(`  Lowest approved villes (5 first) :`);
      for (const r of t3Approved.slice(0, 5)) {
        console.log(`    - ${r.villeSlug} (score ${r.qualityScore})`);
      }
    }
  } finally {
    await p.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
