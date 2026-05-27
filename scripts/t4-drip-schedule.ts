#!/usr/bin/env tsx
/**
 * Drip indexing — génère le planning d'activation progressive des villes.
 *
 * Stratégie SEO recommandée : ne pas exposer 1700+ nouvelles URLs à Google
 * d'un coup (signal "scaled content abuse"). Au lieu de ça, débloquer N villes
 * par jour de manière stable et naturelle.
 *
 * Output : `_AUDIT/VILLES-T4-PROGRESS/drip-schedule.json` mappant slug → date ISO.
 *
 * Lecture par :
 * - `src/lib/seo-noindex-routes.ts` : filtre INDEXABLE_VILLE_SLUGS par date courante
 * - `src/content/villes/index.ts` : `getIndexableVilles()` même filtre
 * - `app/sitemap.ts` : exclut les villes pas encore "drippées"
 *
 * Usage :
 *   pnpm tsx scripts/t4-drip-schedule.ts                   # Génère schedule défaut (20 villes/jour)
 *   pnpm tsx scripts/t4-drip-schedule.ts --per-day=15      # 15 villes/jour
 *   pnpm tsx scripts/t4-drip-schedule.ts --start=2026-06-01 # Démarre à cette date (défaut: demain)
 *   pnpm tsx scripts/t4-drip-schedule.ts --immediate-t1-t2-t3  # T1+T2+T3 activées immédiatement (recommandé)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { VILLES } from "../src/content/villes";

const SCHEDULE_PATH = resolve(process.cwd(), "_AUDIT/VILLES-T4-PROGRESS/drip-schedule.json");

interface DripSchedule {
  generatedAt: string;
  config: {
    perDay: number;
    startDate: string;
    immediateT1T2T3: boolean;
  };
  total: number;
  immediateCount: number;
  drippedCount: number;
  endDate: string;
  // slug → date YYYY-MM-DD à partir de laquelle la ville devient indexable
  villes: Record<string, string>;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let perDay = 20;
  let startDate: string | null = null;
  let immediateT1T2T3 = true; // défaut : T1+T2+T3 activées tout de suite

  for (const arg of argv) {
    if (arg.startsWith("--per-day=")) perDay = parseInt(arg.replace("--per-day=", ""), 10);
    else if (arg.startsWith("--start=")) startDate = arg.replace("--start=", "");
    else if (arg === "--no-immediate") immediateT1T2T3 = false;
  }

  if (!startDate) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1); // demain
    startDate = d.toISOString().slice(0, 10);
  }

  return { perDay, startDate, immediateT1T2T3 };
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function main() {
  const args = parseArgs();
  const today = new Date().toISOString().slice(0, 10);

  // Toutes les villes qui ont un fichier TS copy/<slug>.ts (incluant T1+T2+T3 manuels + auto)
  const VILLE_WITH_COPY = VILLES.filter((v) => !!v.copy);

  const immediateSet = new Set<string>();
  const drippedQueue: string[] = [];

  if (args.immediateT1T2T3) {
    // T1+T2+T3 (population >= 20k) : activées immédiatement (déjà live de toute façon)
    for (const v of VILLE_WITH_COPY) {
      if (v.population >= 20_000) immediateSet.add(v.slug);
      else drippedQueue.push(v.slug);
    }
  } else {
    // Tout est drippé (rare)
    for (const v of VILLE_WITH_COPY) drippedQueue.push(v.slug);
  }

  // Tri du drip queue : par priorité géographique (Will 2026-05-27)
  // Auvergne-Rhône-Alpes → IDF → reste, puis population décroissante
  drippedQueue.sort((a, b) => {
    const va = VILLE_WITH_COPY.find((v) => v.slug === a)!;
    const vb = VILLE_WITH_COPY.find((v) => v.slug === b)!;
    const regionRank = (r: string): number => {
      if (r === "auvergne-rhone-alpes") return 0;
      if (r === "ile-de-france") return 1;
      return 2;
    };
    const ra = regionRank(va.region);
    const rb = regionRank(vb.region);
    if (ra !== rb) return ra - rb;
    return vb.population - va.population;
  });

  const schedule: Record<string, string> = {};
  for (const slug of immediateSet) schedule[slug] = today;
  // Drip : N par jour à partir de startDate
  for (let i = 0; i < drippedQueue.length; i++) {
    const dayOffset = Math.floor(i / args.perDay);
    schedule[drippedQueue[i]!] = addDays(args.startDate, dayOffset);
  }

  const endDate =
    drippedQueue.length > 0
      ? addDays(args.startDate, Math.ceil(drippedQueue.length / args.perDay) - 1)
      : args.startDate;

  const out: DripSchedule = {
    generatedAt: new Date().toISOString(),
    config: {
      perDay: args.perDay,
      startDate: args.startDate,
      immediateT1T2T3: args.immediateT1T2T3,
    },
    total: VILLE_WITH_COPY.length,
    immediateCount: immediateSet.size,
    drippedCount: drippedQueue.length,
    endDate,
    villes: schedule,
  };

  writeFileSync(SCHEDULE_PATH, JSON.stringify(out, null, 2), "utf-8");

  console.log(`[drip] Schedule generated : ${SCHEDULE_PATH}`);
  console.log(`[drip] Total villes with copy : ${out.total}`);
  console.log(`[drip] Immediate (T1+T2+T3) : ${out.immediateCount}`);
  console.log(`[drip] Dripped (T4) : ${out.drippedCount} (${args.perDay}/jour)`);
  console.log(`[drip] Start : ${args.startDate}  →  End : ${endDate}`);
  console.log("");
  console.log(`Lecture par seo-noindex-routes.ts à chaque requête HTTP : URL devient indexable`);
  console.log(`uniquement si villes[slug] <= today. Avant cette date, page reste noindex.`);
}

main();
