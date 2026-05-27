#!/usr/bin/env tsx
/**
 * Retourne les N prochaines villes T4 à faire (triées par population décroissante).
 * Format de sortie : JSON pour intégration Claude Code.
 *
 * Usage : pnpm tsx scripts/t4-pick-next.ts [N]
 * Défaut : N=10
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROGRESS_PATH = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/progress.json");

interface VilleStatus {
  slug: string;
  nameFr: string;
  region: string;
  departement: string;
  population: number;
  status: "pending" | "done";
}

interface Progress {
  villes: Record<string, VilleStatus>;
  lastBatchNumber: number;
}

const N = parseInt(process.argv[2] ?? "10", 10);
const progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;

const pending = Object.values(progress.villes)
  .filter((v) => v.status === "pending")
  .sort((a, b) => b.population - a.population)
  .slice(0, N);

const nextBatch = progress.lastBatchNumber + 1;
console.log(`# Prochain batch : #${nextBatch} (${pending.length} villes sélectionnées)\n`);
console.log(JSON.stringify({ batchNumber: nextBatch, villes: pending }, null, 2));
