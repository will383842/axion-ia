// Script standalone — génération des sitemaps images villes (3 fichiers XML).
//
// Conforme Google Image Sitemap 1.1 + namespace Geo.
//
// Output :
//   public/sitemap-images-villes-t1.xml   — Tier 1 (> 100K hab.)
//   public/sitemap-images-villes-t2.xml   — Tier 2 (50K–100K hab.)
//   public/sitemap-images-villes-t3-t4.xml — Tier 3+4 (5K–50K hab.)
//
// Usage :
//   npx tsx src/scripts/generate-sitemap-images-cities.ts
//   SITE_URL=https://axion-ia.com npx tsx src/scripts/generate-sitemap-images-cities.ts
//
// Format XML : Google Image Sitemap 1.1
//   https://www.sitemaps.org/schemas/sitemap/0.9
//   https://www.google.com/schemas/sitemap-image/1.1
//
// Note : les sitemaps générés doivent être référencés dans sitemap-index.xml
// ou dans robots.txt pour être découverts par Google. Il est recommandé de
// soumettre manuellement via Google Search Console après la première génération.

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

// ─── Seuils de tier ───────────────────────────────────────────────────────────

const TIER1_MIN = 100_000;
const TIER2_MIN = 50_000;
const TIER2_MAX = 100_000;
const TIER3_MIN = 10_000;
const TIER3_MAX = 50_000;
const TIER4_MIN = 5_000;
const TIER4_MAX = 10_000;

// ─── Config ───────────────────────────────────────────────────────────────────

const SITE_URL = process.env.SITE_URL ?? "https://axion-ia.com";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../content/villes/data");
const PUBLIC_DIR = path.join(__dirname, "../../public");

// ─── Helpers image ────────────────────────────────────────────────────────────

const REGION_IMAGE_SLUG: Record<string, string> = {
  "ile-de-france":              "axion-ia-ile-de-france-formation-ia-banniere",
  "auvergne-rhone-alpes":       "axion-ia-auvergne-rhone-alpes-formation-ia-banniere",
  "provence-alpes-cote-d-azur": "axion-ia-provence-alpes-cote-d-azur-formation-ia-banniere",
  "occitanie":                  "axion-ia-occitanie-formation-ia-banniere",
  "nouvelle-aquitaine":         "axion-ia-nouvelle-aquitaine-formation-ia-banniere",
  "hauts-de-france":            "axion-ia-hauts-de-france-formation-ia-banniere",
  "grand-est":                  "axion-ia-grand-est-formation-ia-banniere",
  "pays-de-la-loire":           "axion-ia-pays-de-la-loire-formation-ia-banniere",
  "bretagne":                   "axion-ia-bretagne-formation-ia-banniere",
  "normandie":                  "axion-ia-normandie-formation-ia-banniere",
  "bourgogne-franche-comte":    "axion-ia-bourgogne-franche-comte-formation-ia-banniere",
  "centre-val-de-loire":        "axion-ia-centre-val-de-loire-formation-ia-banniere",
  "corse":                      "axion-ia-corse-formation-ia-banniere",
};
const NATIONAL_FALLBACK_SLUG = "axion-ia-france-formation-ia-banniere";

function getImageSlug(ville: VilleData, tier: 1 | 2 | 3 | 4): string {
  if (tier === 1 || tier === 2) {
    // T1 et T2 ont des images dédiées
    return `axion-ia-${ville.slug}-formation-ia-banniere`;
  }
  // T3/T4 → image générique de la région
  return REGION_IMAGE_SLUG[ville.region] ?? NATIONAL_FALLBACK_SLUG;
}

function getPageUrl(ville: VilleData): string {
  return `${SITE_URL}/fr/formation-ia/${ville.slug}`;
}

function getImageUrl(imageSlug: string): string {
  return `${SITE_URL}/images/${imageSlug}.webp`;
}

// ─── XML builder ──────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface UrlEntry {
  loc: string;
  imageUrl: string;
  imageTitle: string;
  imageCaption: string;
  geoLocation: string;
  changefreq: string;
  priority: string;
}

function buildXml(entries: UrlEntry[]): string {
  const urls = entries.map((e) => `  <url>
    <loc>${escapeXml(e.loc)}</loc>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
    <image:image>
      <image:loc>${escapeXml(e.imageUrl)}</image:loc>
      <image:title>${escapeXml(e.imageTitle)}</image:title>
      <image:caption>${escapeXml(e.imageCaption)}</image:caption>
      <image:geo_location>${escapeXml(e.geoLocation)}</image:geo_location>
    </image:image>
  </url>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;
}

function villeToEntry(ville: VilleData, tier: 1 | 2 | 3 | 4): UrlEntry {
  const imageSlug = getImageSlug(ville, tier);
  const deptLabel = ville.departementLabel ?? ville.departement;
  const isGeneric = tier === 3 || tier === 4;

  // T1 = priority 0.9 (villes majeures), T2 = 0.7, T3/T4 = 0.5
  const priority = tier === 1 ? "0.9" : tier === 2 ? "0.7" : "0.5";
  // T1 = weekly (publications fréquentes), T2/T3/T4 = monthly
  const changefreq = tier === 1 ? "weekly" : "monthly";

  const imageTitle = isGeneric
    ? `Formation IA en ${ville.nameFr} — Axion-IA`
    : `Formation IA à ${ville.nameFr} — Axion-IA`;

  const imageCaption = `Axion-IA accompagne les professionnels et entreprises de ${ville.nameFr} (${deptLabel}) dans leur montée en compétences sur l'intelligence artificielle : formations, audits, implémentations.`;

  const geoLocation = `${ville.nameFr}, ${deptLabel}, France`;

  return {
    loc: getPageUrl(ville),
    imageUrl: getImageUrl(imageSlug),
    imageTitle,
    imageCaption,
    geoLocation,
    changefreq,
    priority,
  };
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

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
  console.log(`\n[sitemap-images-cities] Génération sitemaps images villes`);
  console.log(`[sitemap-images-cities] SITE_URL = ${SITE_URL}\n`);

  const allVilles = await loadAllVilles();
  console.log(`[sitemap-images-cities] ${allVilles.length} communes chargées`);

  const t1 = allVilles
    .filter((v) => v.population >= TIER1_MIN)
    .sort((a, b) => b.population - a.population);

  const t2 = allVilles
    .filter((v) => v.population >= TIER2_MIN && v.population < TIER2_MAX)
    .sort((a, b) => b.population - a.population);

  const t3t4 = allVilles
    .filter((v) => v.population >= TIER4_MIN && v.population < TIER3_MAX)
    .sort((a, b) => b.population - a.population);

  console.log(`[sitemap-images-cities] T1 (>= ${TIER1_MIN / 1000}K):   ${t1.length} villes`);
  console.log(`[sitemap-images-cities] T2 (${TIER2_MIN / 1000}K–${TIER2_MAX / 1000}K): ${t2.length} villes`);
  console.log(`[sitemap-images-cities] T3+T4 (${TIER4_MIN / 1000}K–${TIER3_MAX / 1000}K): ${t3t4.length} villes\n`);

  // Build XML
  const xmlT1 = buildXml(t1.map((v) => villeToEntry(v, 1)));
  const xmlT2 = buildXml(t2.map((v) => villeToEntry(v, 2)));
  const xmlT3T4 = buildXml(
    t3t4.map((v) => villeToEntry(v, v.population >= TIER3_MIN ? 3 : 4)),
  );

  // Write
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const files: Array<{ name: string; content: string; count: number }> = [
    { name: "sitemap-images-villes-t1.xml", content: xmlT1, count: t1.length },
    { name: "sitemap-images-villes-t2.xml", content: xmlT2, count: t2.length },
    { name: "sitemap-images-villes-t3-t4.xml", content: xmlT3T4, count: t3t4.length },
  ];

  for (const { name, content, count } of files) {
    const outPath = path.join(PUBLIC_DIR, name);
    await fs.writeFile(outPath, content, "utf-8");
    console.log(`✓ ${name} — ${count} URLs → ${outPath}`);
  }

  const totalUrls = t1.length + t2.length + t3t4.length;
  console.log(`\n[sitemap-images-cities] Total : ${totalUrls} URLs réparties sur 3 fichiers`);
  console.log(`[sitemap-images-cities] Soumettre via Google Search Console après génération`);
}

main().catch((err) => {
  console.error("[sitemap-images-cities] Fatal:", err);
  process.exit(1);
});
