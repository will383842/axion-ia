#!/usr/bin/env tsx
/**
 * Liste les villes T3 (20k-100k hab) sans fichier TS copy/<slug>.ts.
 * Sortie JSON pour traitement manuel par Claude Code.
 */
import { VILLES } from "../src/content/villes";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const COPY_DIR = resolve(process.cwd(), "src/content/villes/copy");

const missing = VILLES.filter((v) => {
  if (v.population < 20_000 || v.population >= 100_000) return false;
  return !existsSync(resolve(COPY_DIR, `${v.slug}.ts`));
})
  .sort((a, b) => b.population - a.population)
  .map((v) => ({
    slug: v.slug,
    nameFr: v.nameFr,
    region: v.region,
    departement: v.departementLabel ?? v.departement,
    population: v.population,
    inseeCode: v.inseeCode,
    economicData: v.economicData
      ? {
          topSectorsNaf: v.economicData.topSectorsNaf?.slice(0, 5).map((s) => s.label),
          grandsGroupes: v.economicData.grandsGroupesImplantes?.slice(0, 4).map((g) => g.nom),
        }
      : null,
  }));

console.log(`Total T3 villes sans TS file : ${missing.length}`);
console.log(JSON.stringify(missing, null, 2));
