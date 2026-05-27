#!/usr/bin/env tsx
import { PrismaClient } from "../prisma/generated/client";

async function main() {
  const p = new PrismaClient();
  try {
    const rows = await p.generatedVilleCopy.findMany({
      where: { status: "approved" },
      select: { villeSlug: true, qualityScore: true, modelUsed: true },
      orderBy: { qualityScore: "asc" },
    });
    const scores = rows.map((r) => r.qualityScore ?? 0);
    console.log("Total approved:", rows.length);
    if (rows.length === 0) return;
    console.log(
      "Min/p25/median/p75/max:",
      scores[0],
      "/",
      scores[Math.floor(scores.length * 0.25)],
      "/",
      scores[Math.floor(scores.length / 2)],
      "/",
      scores[Math.floor(scores.length * 0.75)],
      "/",
      scores[scores.length - 1],
    );
    const byModel: Record<string, number> = {};
    rows.forEach((r) => {
      const m = r.modelUsed ?? "unknown";
      byModel[m] = (byModel[m] || 0) + 1;
    });
    console.log("Models used:", JSON.stringify(byModel));
    console.log(
      "Sample lowest 3:",
      rows.slice(0, 3).map((r) => `${r.villeSlug}=${r.qualityScore}/${r.modelUsed}`),
    );
    console.log(
      "Sample highest 3:",
      rows.slice(-3).map((r) => `${r.villeSlug}=${r.qualityScore}/${r.modelUsed}`),
    );
  } finally {
    await p.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
