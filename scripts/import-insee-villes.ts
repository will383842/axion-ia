// Import INSEE communes >= 5 000 hab depuis geo.api.gouv.fr (officiel gouv FR)
// et génère les 18 fichiers `src/content/villes/data/<region-slug>.ts`.
//
// Usage : `pnpm villes:import`
// Reproductible — re-run après chaque mise à jour du recensement légal INSEE.
//
// Notes :
//  - Pas de clé API requise (endpoint open).
//  - Source de vérité = geo.api.gouv.fr (INSEE-backed). Aucune hallucination.
//  - Collisions de slugs : la France métropolitaine garde le slug propre,
//    les DROM se voient suffixer du code département (ex. "saint-denis"
//    pour Saint-Denis 93, "saint-denis-974" pour Saint-Denis Réunion).
//  - Réécrit complètement chaque fichier `data/<region>.ts`. Ne touche pas
//    aux fichiers `copy/*` curatés à la main.
import fs from "node:fs";
import path from "node:path";

import { REGIONS } from "../src/content/regions";

const API_URL =
  "https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,centre,population,codeDepartement,codeRegion&format=json&geometry=centre";
const POP_THRESHOLD = 5000;
const DATA_DIR = path.resolve("src/content/villes/data");

interface ApiCommune {
  nom: string;
  code: string;
  codesPostaux?: string[];
  centre?: { type: "Point"; coordinates: [number, number] };
  population?: number;
  codeDepartement: string;
  codeRegion: string;
}

interface VilleDataOut {
  slug: string;
  nameFr: string;
  nameEn?: string;
  region: string;
  departement: string;
  departementLabel?: string;
  inseeCode: string;
  postalCode?: string;
  population: number;
  geo: { lat: number; lon: number };
}

const REGION_SLUG_BY_CODE: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.inseeCode, r.slug]),
);

const DROM_REGION_CODES = new Set(REGIONS.filter((r) => r.type === "drom").map((r) => r.inseeCode));

const CONST_NAME_BY_REGION_SLUG: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.slug, `VILLES_${r.slug.toUpperCase().replace(/-/g, "_")}`]),
);

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove combining marks
    .toLowerCase()
    .replace(/['']/g, "-") // straight + curly apostrophes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchCommunes(): Promise<ApiCommune[]> {
  console.warn(`[import:villes] fetching ${API_URL}`);
  const t0 = Date.now();
  const res = await fetch(API_URL);
  if (!res.ok) {
    throw new Error(`geo.api.gouv.fr returned ${res.status} ${res.statusText}`);
  }
  const all = (await res.json()) as ApiCommune[];
  console.warn(`[import:villes] received ${all.length} communes in ${Date.now() - t0}ms`);
  return all;
}

function assignSlugs(communes: ApiCommune[]): Map<string, string> {
  // Priority order for slug collision: metropolitan first, then by population desc.
  // Bigger metropolitan wins clean slug; DROM and smaller communes get -dept suffix.
  const sorted = [...communes].sort((a, b) => {
    const aDrom = DROM_REGION_CODES.has(a.codeRegion);
    const bDrom = DROM_REGION_CODES.has(b.codeRegion);
    if (aDrom !== bDrom) return aDrom ? 1 : -1;
    return (b.population ?? 0) - (a.population ?? 0);
  });

  const used = new Set<string>();
  const slugByInsee = new Map<string, string>();
  for (const c of sorted) {
    let slug = slugify(c.nom);
    if (used.has(slug)) {
      slug = `${slug}-${c.codeDepartement.toLowerCase()}`;
    }
    if (used.has(slug)) {
      // Extreme edge case — third collision. Append INSEE code (always unique).
      slug = `${slugify(c.nom)}-${c.code.toLowerCase()}`;
    }
    used.add(slug);
    slugByInsee.set(c.code, slug);
  }
  return slugByInsee;
}

function toVilleData(c: ApiCommune, slug: string, regionSlug: string): VilleDataOut {
  if (!c.centre || !Array.isArray(c.centre.coordinates) || c.centre.coordinates.length < 2) {
    throw new Error(`commune ${c.code} (${c.nom}) missing centre coordinates`);
  }
  const [lon, lat] = c.centre.coordinates;
  const postal = c.codesPostaux?.[0];
  return {
    slug,
    nameFr: c.nom,
    nameEn: c.nom,
    region: regionSlug,
    departement: c.codeDepartement,
    departementLabel: c.codeDepartement,
    inseeCode: c.code,
    ...(postal !== undefined ? { postalCode: postal } : {}),
    population: c.population ?? 0,
    geo: { lat: round5(lat), lon: round5(lon) },
  };
}

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function serializeVille(v: VilleDataOut): string {
  // Aligns roughly with prettier output. `pnpm format` will do the final pass.
  const lines: string[] = ["  {"];
  lines.push(`    slug: ${JSON.stringify(v.slug)},`);
  lines.push(`    nameFr: ${JSON.stringify(v.nameFr)},`);
  if (v.nameEn !== undefined) lines.push(`    nameEn: ${JSON.stringify(v.nameEn)},`);
  lines.push(`    region: ${JSON.stringify(v.region)},`);
  lines.push(`    departement: ${JSON.stringify(v.departement)},`);
  if (v.departementLabel !== undefined)
    lines.push(`    departementLabel: ${JSON.stringify(v.departementLabel)},`);
  lines.push(`    inseeCode: ${JSON.stringify(v.inseeCode)},`);
  if (v.postalCode !== undefined) lines.push(`    postalCode: ${JSON.stringify(v.postalCode)},`);
  lines.push(`    population: ${v.population},`);
  lines.push(`    geo: { lat: ${v.geo.lat}, lon: ${v.geo.lon} },`);
  lines.push("  },");
  return lines.join("\n");
}

function buildRegionFile(
  regionSlug: string,
  regionNameFr: string,
  villes: ReadonlyArray<VilleDataOut>,
): string {
  const constName = CONST_NAME_BY_REGION_SLUG[regionSlug];
  if (!constName) throw new Error(`No const name mapped for region ${regionSlug}`);

  const header = [
    `// ${regionNameFr} — données INSEE (geo.api.gouv.fr).`,
    `// Auto-généré par \`scripts/import-insee-villes.ts\` — NE PAS ÉDITER À LA MAIN.`,
    `// Filtre : population >= ${POP_THRESHOLD}. Total : ${villes.length} commune(s).`,
    `import type { VilleData } from "./types";`,
    "",
    `export const ${constName}: ReadonlyArray<VilleData> = [`,
  ].join("\n");

  const body = villes.map(serializeVille).join("\n");
  const footer = "];\n";

  return villes.length === 0 ? `${header}${footer}` : `${header}\n${body}\n${footer}`;
}

async function main(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const all = await fetchCommunes();
  const filtered = all.filter((c) => (c.population ?? 0) >= POP_THRESHOLD);
  console.warn(`[import:villes] kept ${filtered.length} communes >= ${POP_THRESHOLD} hab`);

  const slugByInsee = assignSlugs(filtered);

  // Group by region (using INSEE codeRegion → region slug).
  const byRegionSlug = new Map<string, VilleDataOut[]>();
  for (const r of REGIONS) byRegionSlug.set(r.slug, []);

  let skipped = 0;
  for (const c of filtered) {
    const regionSlug = REGION_SLUG_BY_CODE[c.codeRegion];
    if (!regionSlug) {
      skipped++;
      continue;
    }
    const slug = slugByInsee.get(c.code);
    if (!slug) throw new Error(`No slug for commune ${c.code}`);
    byRegionSlug.get(regionSlug)!.push(toVilleData(c, slug, regionSlug));
  }
  if (skipped > 0) {
    console.warn(
      `[import:villes] skipped ${skipped} communes with unmapped codeRegion (likely COM/TAAF)`,
    );
  }

  // Sort each region by population desc — biggest cities first in the array.
  for (const [, arr] of byRegionSlug) {
    arr.sort((a, b) => b.population - a.population);
  }

  // Write each region file.
  const summary: Array<{ region: string; count: number }> = [];
  for (const r of REGIONS) {
    const villes = byRegionSlug.get(r.slug) ?? [];
    const filePath = path.join(DATA_DIR, `${r.slug}.ts`);
    fs.writeFileSync(filePath, buildRegionFile(r.slug, r.nameFr, villes), "utf-8");
    summary.push({ region: r.slug, count: villes.length });
  }

  // Print summary.
  console.warn("[import:villes] per-region totals:");
  let total = 0;
  for (const s of summary) {
    console.warn(`  ${s.region.padEnd(30)} ${s.count.toString().padStart(4)}`);
    total += s.count;
  }
  console.warn(`[import:villes] total written: ${total} villes across ${summary.length} regions`);
}

main().catch((err: unknown) => {
  console.error("[import:villes] failed:", err);
  process.exit(1);
});
