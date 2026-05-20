// Script standalone — génération des métadonnées image pour les villes T3/T4.
//
// Tier 3 = population entre 10 000 et 50 000 habitants.
// Tier 4 = population entre 5 000 et 10 000 habitants.
//
// Ces villes n'ont pas d'image dédiée — elles réutilisent des images génériques
// de la banque d'images (une par région, ou une image nationale de fallback).
//
// Output :
//   public/city-image-metadata-t3-t4.json
//
// Format du JSON :
//   {
//     "generatedAt": "<ISO>",
//     "count": 2034,
//     "villes": [
//       {
//         "slug": "...",
//         "nameFr": "...",
//         "region": "...",
//         "tier": 3 | 4,
//         "population": 12345,
//         "geo": { "lat": 0, "lon": 0 },
//         "imageSlug": "axion-ia-{region}-formation-ia-banniere",
//         "imagePath": "/images/axion-ia-{region}-formation-ia-banniere.webp",
//         "altFr": "Formation IA à {nameFr} — Axion-IA",
//         "altEn": "AI Training in {nameFr} — Axion-IA",
//         "isGeneric": true
//       }
//     ]
//   }
//
// Usage :
//   npx tsx src/scripts/generate-city-image-metadata.ts
//   npx tsx src/scripts/generate-city-image-metadata.ts --out=public/my-output.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Standalone VilleData ────────────────────────────────────────────────────

interface VilleData {
  slug: string;
  nameFr: string;
  nameEn?: string;
  region: string;
  departement: string;
  departementLabel?: string;
  inseeCode: string;
  population: number;
  geo: { lat: number; lon: number };
}

// ─── Seuils ──────────────────────────────────────────────────────────────────

const TIER3_MIN = 10_000;
const TIER3_MAX = 50_000;
const TIER4_MIN = 5_000;
const TIER4_MAX = 10_000;

// ─── Mapping région → slug image générique ───────────────────────────────────
// Ces slugs supposent que les images génériques par région existent dans
// public/images/. Si elles sont absentes, le fallback national s'applique.

const REGION_IMAGE_SLUG: Record<string, string> = {
  "ile-de-france":            "axion-ia-ile-de-france-formation-ia-banniere",
  "auvergne-rhone-alpes":     "axion-ia-auvergne-rhone-alpes-formation-ia-banniere",
  "provence-alpes-cote-d-azur": "axion-ia-provence-alpes-cote-d-azur-formation-ia-banniere",
  "occitanie":                "axion-ia-occitanie-formation-ia-banniere",
  "nouvelle-aquitaine":       "axion-ia-nouvelle-aquitaine-formation-ia-banniere",
  "hauts-de-france":          "axion-ia-hauts-de-france-formation-ia-banniere",
  "grand-est":                "axion-ia-grand-est-formation-ia-banniere",
  "pays-de-la-loire":         "axion-ia-pays-de-la-loire-formation-ia-banniere",
  "bretagne":                 "axion-ia-bretagne-formation-ia-banniere",
  "normandie":                "axion-ia-normandie-formation-ia-banniere",
  "bourgogne-franche-comte":  "axion-ia-bourgogne-franche-comte-formation-ia-banniere",
  "centre-val-de-loire":      "axion-ia-centre-val-de-loire-formation-ia-banniere",
  "corse":                    "axion-ia-corse-formation-ia-banniere",
};

const NATIONAL_FALLBACK_SLUG = "axion-ia-france-formation-ia-banniere";

function getImageSlug(region: string): string {
  return REGION_IMAGE_SLUG[region] ?? NATIONAL_FALLBACK_SLUG;
}

function getImagePath(imageSlug: string): string {
  return `/images/${imageSlug}.webp`;
}

// ─── Types output ─────────────────────────────────────────────────────────────

interface VilleImageMetadata {
  slug: string;
  nameFr: string;
  region: string;
  tier: 3 | 4;
  population: number;
  geo: { lat: number; lon: number };
  imageSlug: string;
  imagePath: string;
  altFr: string;
  altEn: string;
  isGeneric: true;
}

interface MetadataOutput {
  generatedAt: string;
  count: number;
  tiers: { t3: number; t4: number };
  villes: VilleImageMetadata[];
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../content/villes/data");

async function loadAllVilles(): Promise<VilleData[]> {
  const files = await fs.readdir(DATA_DIR);
  const tsFiles = files.filter((f) => f.endsWith(".ts") && f !== "types.ts");

  const all: VilleData[] = [];
  for (const file of tsFiles) {
    const mod = (await import(path.join(DATA_DIR, file))) as Record<string, unknown>;
    const exportedArrays = Object.values(mod).filter(Array.isArray);
    for (const arr of exportedArrays) {
      all.push(...(arr as VilleData[]));
    }
  }
  return all;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const outArg = args.find((a) => a.startsWith("--out="))?.split("=")[1];
  const defaultOut = path.join(__dirname, "../../public/city-image-metadata-t3-t4.json");
  const outputPath = outArg ? path.resolve(outArg) : defaultOut;

  console.log("\n[city-image-metadata] Génération métadonnées T3/T4...");

  const allVilles = await loadAllVilles();

  const t3 = allVilles.filter(
    (v) => v.population >= TIER3_MIN && v.population < TIER3_MAX,
  );
  const t4 = allVilles.filter(
    (v) => v.population >= TIER4_MIN && v.population < TIER4_MAX,
  );

  console.log(`[city-image-metadata] T3 (${TIER3_MIN / 1000}K–${TIER3_MAX / 1000}K): ${t3.length} villes`);
  console.log(`[city-image-metadata] T4 (${TIER4_MIN / 1000}K–${TIER4_MAX / 1000}K): ${t4.length} villes`);

  const villesMeta: VilleImageMetadata[] = [];

  for (const v of [...t3, ...t4]) {
    const tier: 3 | 4 = v.population >= TIER3_MIN ? 3 : 4;
    const imageSlug = getImageSlug(v.region);
    villesMeta.push({
      slug: v.slug,
      nameFr: v.nameFr,
      region: v.region,
      tier,
      population: v.population,
      geo: v.geo,
      imageSlug,
      imagePath: getImagePath(imageSlug),
      altFr: `Formation IA à ${v.nameFr} — Axion-IA`,
      altEn: `AI Training in ${v.nameEn ?? v.nameFr} — Axion-IA`,
      isGeneric: true,
    });
  }

  // Tri par population décroissante puis slug
  villesMeta.sort((a, b) => b.population - a.population || a.slug.localeCompare(b.slug));

  const output: MetadataOutput = {
    generatedAt: new Date().toISOString(),
    count: villesMeta.length,
    tiers: { t3: t3.length, t4: t4.length },
    villes: villesMeta,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");

  console.log(
    `[city-image-metadata] ${villesMeta.length} entrées écrites → ${outputPath}`,
  );
}

main().catch((err) => {
  console.error("[city-image-metadata] Fatal:", err);
  process.exit(1);
});
