#!/usr/bin/env tsx
/**
 * Affiche le status global du sprint T4.
 * Lit `_AUDIT/VILLES-T4-PROGRESS/progress.json` (source de vérité).
 *
 * Usage : pnpm tsx scripts/t4-status.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROGRESS_PATH = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/progress.json");

interface Progress {
  totalT4: number;
  done: number;
  remaining: number;
  lastBatchAt: string | null;
  lastBatchSize: number;
  lastBatchNumber: number;
  villes: Record<
    string,
    {
      slug: string;
      nameFr: string;
      population: number;
      region: string;
      status: "pending" | "done";
      batch: number | null;
    }
  >;
}

if (!existsSync(PROGRESS_PATH)) {
  console.error(
    "[t4-status] progress.json absent — lancer d'abord : pnpm tsx scripts/t4-sync-progress.ts",
  );
  process.exit(1);
}

const progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;

const pct = ((progress.done / progress.totalT4) * 100).toFixed(1);
console.log("");
console.log("═══════════════════════════════════════════════════════════════");
console.log("  SPRINT T4 VILLES (<20k hab) — STATUS");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`  ✅ DONE      : ${progress.done} / ${progress.totalT4} (${pct} %)`);
console.log(`  ⏳ PENDING   : ${progress.remaining}`);
console.log(
  `  📦 Last batch : #${progress.lastBatchNumber} (${progress.lastBatchSize} villes) — ${progress.lastBatchAt ?? "jamais"}`,
);
console.log("");

// Top 10 pending par population (les plus stratégiques d'abord)
const pending = Object.values(progress.villes)
  .filter((v) => v.status === "pending")
  .sort((a, b) => b.population - a.population);

console.log(`  🎯 PROCHAINES VILLES À FAIRE (top 10 par population) :`);
for (let i = 0; i < Math.min(10, pending.length); i++) {
  const v = pending[i]!;
  console.log(
    `     ${String(i + 1).padStart(2)}. ${v.nameFr.padEnd(35)} ${String(v.population).padStart(6)} hab  ${v.region}`,
  );
}
console.log("");

// Done by batch (historique)
const byBatch = new Map<number, number>();
for (const v of Object.values(progress.villes)) {
  if (v.batch !== null) byBatch.set(v.batch, (byBatch.get(v.batch) ?? 0) + 1);
}
if (byBatch.size > 0) {
  console.log(`  📈 HISTORIQUE BATCHES :`);
  const sortedBatches = [...byBatch.entries()].sort((a, b) => a[0] - b[0]);
  for (const [batch, count] of sortedBatches) {
    console.log(`     Batch #${String(batch).padStart(3)} : ${count} villes`);
  }
  console.log("");
}

console.log("  💡 Prochaines commandes :");
console.log(`     pnpm tsx scripts/t4-pick-next.ts 25   # Voir prochaines 25 à faire`);
console.log(`     Will : "Fais le prochain batch T4 de 25"  → Claude génère`);
console.log("");
