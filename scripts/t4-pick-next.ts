#!/usr/bin/env tsx
/**
 * Retourne les N prochaines villes T4 à faire selon l'ordre Will :
 *   1. Auvergne-Rhône-Alpes : Isère (38) → Drôme (26) → Loire (42) → Rhône (69) → autres
 *   2. Île-de-France : 75 → 92 → 93 → 94 → 91 → 95 → 77 → 78
 *   3. Reste des régions par ordre alphabétique
 *   À secteur géo fixe : tri par population décroissante.
 *
 * Usage : pnpm tsx scripts/t4-pick-next.ts [N]
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

// Priority order : (region, departement)
// Will 2026-05-27 : Rhône-Alpes en premier (Isère, Drôme, Loire, Rhône, puis autres)
// puis IDF, puis reste alphabétique.
const PRIORITY: Array<{ region: string; departements: string[] }> = [
  // 1. Auvergne-Rhône-Alpes — ordre Will explicite + autres
  {
    region: "auvergne-rhone-alpes",
    departements: [
      "38", // Isère
      "26", // Drôme
      "42", // Loire
      "69", // Rhône
      "01", // Ain
      "03", // Allier
      "07", // Ardèche
      "15", // Cantal
      "43", // Haute-Loire
      "63", // Puy-de-Dôme
      "73", // Savoie
      "74", // Haute-Savoie
    ],
  },
  // 2. Île-de-France
  {
    region: "ile-de-france",
    departements: ["75", "92", "93", "94", "91", "95", "77", "78"],
  },
  // 3. Reste alphabétique
  { region: "bourgogne-franche-comte", departements: [] },
  { region: "bretagne", departements: [] },
  { region: "centre-val-de-loire", departements: [] },
  { region: "corse", departements: [] },
  { region: "grand-est", departements: [] },
  { region: "hauts-de-france", departements: [] },
  { region: "normandie", departements: [] },
  { region: "nouvelle-aquitaine", departements: [] },
  { region: "occitanie", departements: [] },
  { region: "pays-de-la-loire", departements: [] },
  { region: "provence-alpes-cote-d-azur", departements: [] },
];

/** Returns a sort key for a ville. Lower = higher priority. */
function priorityKey(v: VilleStatus): number {
  // departement string : may be label or code — try to extract just the digits
  const deptCode = (v.departement.match(/\d+/)?.[0] ?? v.departement).padStart(2, "0");
  for (let regionIdx = 0; regionIdx < PRIORITY.length; regionIdx++) {
    const p = PRIORITY[regionIdx]!;
    if (p.region !== v.region) continue;
    // Within region : priorité département listé
    if (p.departements.length > 0) {
      const dIdx = p.departements.indexOf(deptCode);
      if (dIdx >= 0) return regionIdx * 1000 + dIdx;
      // departement pas dans la liste prioritaire — fallback à la fin de la région
      return regionIdx * 1000 + 100 + parseInt(deptCode, 10);
    }
    // Région sans tri département explicite → ordre alphabétique département
    return regionIdx * 1000 + parseInt(deptCode, 10);
  }
  // Région inconnue → fin
  return 999999;
}

const N = parseInt(process.argv[2] ?? "10", 10);
const progress = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8")) as Progress;

const pending = Object.values(progress.villes)
  .filter((v) => v.status === "pending")
  .sort((a, b) => {
    const ka = priorityKey(a);
    const kb = priorityKey(b);
    if (ka !== kb) return ka - kb;
    // Même priorité géographique → population décroissante
    return b.population - a.population;
  })
  .slice(0, N);

const nextBatch = progress.lastBatchNumber + 1;
console.log(`# Prochain batch : #${nextBatch} (${pending.length} villes sélectionnées)\n`);
console.log(`# Ordre : Auvergne-Rhône-Alpes (38→26→42→69→autres) → IDF → reste\n`);
console.log(JSON.stringify({ batchNumber: nextBatch, villes: pending }, null, 2));
