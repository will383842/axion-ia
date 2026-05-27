#!/usr/bin/env tsx
/**
 * Scan FS + sync `_AUDIT/VILLES-T4-PROGRESS/progress.json` avec l'état réel.
 *
 * Détecte :
 * - Nouvelles villes T4 ajoutées (status=done si fichier TS existe, pending sinon)
 * - Villes done ajoutées hors workflow (status passe à done)
 * - Drift entre JSON et FS
 *
 * Usage : pnpm tsx scripts/t4-sync-progress.ts
 * À lancer au moins 1 fois après création de progress.json.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { VILLES } from "../src/content/villes";

const PROGRESS_PATH = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/progress.json");
const COPY_DIR = resolve(process.cwd(), "src/content/villes/copy");

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

function main() {
  // Toutes les villes T4 (pop < 20k) — l'univers complet à traiter
  const t4Villes = VILLES.filter((v) => v.population < 20_000);

  // Existing progress (si lance précédent)
  let existing: Progress | null = null;
  if (existsSync(PROGRESS_PATH)) {
    try {
      existing = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;
    } catch (err) {
      console.warn(`[t4-sync] Failed to parse existing progress.json: ${err}. Recreating.`);
    }
  }

  const villes: Record<string, VilleStatus> = {};
  let done = 0;

  for (const v of t4Villes) {
    const fileExists = existsSync(resolve(COPY_DIR, `${v.slug}.ts`));
    const existingEntry = existing?.villes[v.slug];

    if (fileExists) {
      villes[v.slug] = {
        slug: v.slug,
        nameFr: v.nameFr,
        region: v.region,
        departement: v.departementLabel ?? v.departement,
        population: v.population,
        status: "done",
        doneAt: existingEntry?.doneAt ?? new Date().toISOString(),
        batch: existingEntry?.batch ?? null,
      };
      done++;
    } else {
      villes[v.slug] = {
        slug: v.slug,
        nameFr: v.nameFr,
        region: v.region,
        departement: v.departementLabel ?? v.departement,
        population: v.population,
        status: "pending",
        doneAt: null,
        batch: null,
      };
    }
  }

  const progress: Progress = {
    totalT4: t4Villes.length,
    done,
    remaining: t4Villes.length - done,
    lastBatchAt: existing?.lastBatchAt ?? null,
    lastBatchSize: existing?.lastBatchSize ?? 0,
    lastBatchNumber: existing?.lastBatchNumber ?? 0,
    villes,
  };

  writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), "utf-8");
  console.log(
    `[t4-sync] Progress synced: total=${progress.totalT4}, done=${progress.done}, remaining=${progress.remaining}`,
  );
  console.log(`[t4-sync] Written to: ${PROGRESS_PATH}`);
}

main();
