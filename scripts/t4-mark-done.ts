#!/usr/bin/env tsx
/**
 * Marque N villes comme done (après génération des fichiers TS par Claude Code).
 *
 * Usage : pnpm tsx scripts/t4-mark-done.ts <slug1> <slug2> ... <slugN>
 *
 * Effets :
 * - Lit progress.json
 * - Pour chaque slug : status=done, doneAt=now, batch=lastBatchNumber+1
 * - Met à jour totals (done, remaining)
 * - Update lastBatchAt, lastBatchSize, lastBatchNumber
 * - Écrit log/batch-XXX-YYYY-MM-DD.md
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROGRESS_PATH = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/progress.json");
const LOG_DIR = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/log");

interface VilleStatus {
  slug: string;
  nameFr: string;
  region: string;
  departement: string;
  population: number;
  status: "pending" | "done";
  doneAt: string | null;
  batch: number | null;
}

interface Progress {
  totalT4: number;
  done: number;
  remaining: number;
  lastBatchAt: string | null;
  lastBatchSize: number;
  lastBatchNumber: number;
  villes: Record<string, VilleStatus>;
}

const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  console.error("[t4-mark-done] Usage: pnpm tsx scripts/t4-mark-done.ts <slug1> <slug2> ...");
  process.exit(1);
}

const progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;
const nextBatchNumber = progress.lastBatchNumber + 1;
const now = new Date().toISOString();

const marked: string[] = [];
const notFound: string[] = [];
const alreadyDone: string[] = [];

for (const slug of slugs) {
  const v = progress.villes[slug];
  if (!v) {
    notFound.push(slug);
    continue;
  }
  if (v.status === "done") {
    alreadyDone.push(slug);
    continue;
  }
  v.status = "done";
  v.doneAt = now;
  v.batch = nextBatchNumber;
  marked.push(slug);
}

// Recompute totals
progress.done = Object.values(progress.villes).filter((v) => v.status === "done").length;
progress.remaining = progress.totalT4 - progress.done;
progress.lastBatchAt = now;
progress.lastBatchSize = marked.length;
progress.lastBatchNumber = nextBatchNumber;

writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), "utf-8");

// Log file
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
const date = now.slice(0, 10);
const logPath = resolve(LOG_DIR, `batch-${String(nextBatchNumber).padStart(3, "0")}-${date}.md`);
const logContent = `# Batch T4 #${nextBatchNumber} — ${date}

**Villes ajoutées** : ${marked.length}
**Total done** : ${progress.done} / ${progress.totalT4} (${((progress.done / progress.totalT4) * 100).toFixed(1)} %)
**Remaining** : ${progress.remaining}

## Slugs done in this batch

${marked.map((s) => `- ${s} (${progress.villes[s]!.nameFr}, ${progress.villes[s]!.population} hab)`).join("\n")}

${notFound.length > 0 ? `\n## Slugs not found (erreur)\n\n${notFound.map((s) => `- ${s}`).join("\n")}\n` : ""}
${alreadyDone.length > 0 ? `\n## Slugs déjà done (skip)\n\n${alreadyDone.map((s) => `- ${s}`).join("\n")}\n` : ""}
`;
writeFileSync(logPath, logContent, "utf-8");

console.log(`[t4-mark-done] Marked ${marked.length} villes as done (batch #${nextBatchNumber}).`);
console.log(
  `[t4-mark-done] Total : ${progress.done} / ${progress.totalT4} (${((progress.done / progress.totalT4) * 100).toFixed(1)} %)`,
);
console.log(`[t4-mark-done] Log : ${logPath}`);
if (notFound.length > 0)
  console.warn(`[t4-mark-done] ⚠️  Slugs not found : ${notFound.join(", ")}`);
if (alreadyDone.length > 0)
  console.log(`[t4-mark-done] ℹ️  Already done : ${alreadyDone.join(", ")}`);
