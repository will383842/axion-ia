// Script standalone — génération des bannières Sharp pour les villes Tier 2.
//
// Tier 2 = population entre 50 000 et 100 000 habitants.
//
// Usage :
//   npx tsx src/scripts/generate-city-images-tier2.ts
//   npx tsx src/scripts/generate-city-images-tier2.ts --dry-run
//   npx tsx src/scripts/generate-city-images-tier2.ts --slug=rouen
//
// Output :
//   public/images/axion-ia-{ville.slug}-formation-ia-banniere.webp (1920×1080)
//
// Template requis :
//   public/images/templates/city-banner-template.webp
//   → Si absent, le script génère un fond dégradé de substitution.
//
// Conventions d'output :
//   - Slug de sortie : `axion-ia-{ville.slug}-formation-ia-banniere`
//   - Qualité WebP : 85
//   - Dimensions : 1920 × 1080
//   - Overlay SVG terracotta (#C0440A) sur fond ivoire semi-transparent

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

// ─── VilleData minimal (copie locale pour standalone) ────────────────────────
// On n'importe pas depuis @/ pour éviter les dépendances Next.js dans le script.

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

// ─── Seuils de population par tier ───────────────────────────────────────────

const TIER2_MIN = 50_000;
const TIER2_MAX = 100_000;

// ─── Imports données INSEE ────────────────────────────────────────────────────
// Les fichiers data/ sont du TypeScript pur sans import Next.js → importables
// directement par tsx (résolution via tsconfig paths non-applicable en standalone
// — on utilise des chemins relatifs).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../content/villes/data");

async function loadAllVilles(): Promise<VilleData[]> {
  const files = await fs.readdir(DATA_DIR);
  const tsFiles = files.filter((f) => f.endsWith(".ts") && f !== "types.ts");

  const all: VilleData[] = [];
  for (const file of tsFiles) {
    const mod = (await import(path.join(DATA_DIR, file))) as Record<string, unknown>;
    // Each file exports a single const array (VILLES_*)
    const exportedArrays = Object.values(mod).filter(Array.isArray);
    for (const arr of exportedArrays) {
      all.push(...(arr as VilleData[]));
    }
  }
  return all;
}

// ─── Génération bannière ──────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, "../../public/images");
const TEMPLATE_PATH = path.join(__dirname, "../../public/images/templates/city-banner-template.webp");
const BANNER_W = 1920;
const BANNER_H = 1080;

function buildSvgOverlay(ville: VilleData): Buffer {
  const deptLabel = ville.departementLabel ?? ville.departement;
  // Escape XML entities (noms français : é, è, etc. → pas de & problématique en général
  // mais on sécurise quand même les &)
  const escapeName = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return Buffer.from(
    `<svg width="${BANNER_W}" height="${BANNER_H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="700" height="${BANNER_H}" fill="rgba(250,247,242,0.92)"/>
      <text x="60" y="200" font-family="Georgia,serif" font-size="68" fill="#C0440A" font-weight="bold">${escapeName(ville.nameFr)}</text>
      <text x="60" y="260" font-family="Arial,sans-serif" font-size="26" fill="#1A1A1A">Formations &amp; interventions à ${escapeName(ville.nameFr)}</text>
      <text x="60" y="300" font-family="Arial,sans-serif" font-size="22" fill="#666666">${escapeName(deptLabel)}</text>
      <line x1="60" y1="330" x2="300" y2="330" stroke="#C0440A" stroke-width="3"/>
      <text x="60" y="380" font-family="Arial,sans-serif" font-size="20" fill="#1A1A1A">Formation IA · Audit IA · Implémentations</text>
      <text x="60" y="420" font-family="Arial,sans-serif" font-size="18" fill="#555555">Axion-IA — Conseil &amp; formation en intelligence artificielle</text>
      <text x="60" y="${BANNER_H - 100}" font-family="Arial,sans-serif" font-size="18" fill="#C0440A">axion-ia.com</text>
    </svg>`,
  );
}

async function buildFallbackBackground(): Promise<Buffer> {
  // Fond dégradé ivoire → blanc si le template est absent
  return sharp({
    create: {
      width: BANNER_W,
      height: BANNER_H,
      channels: 3,
      background: { r: 250, g: 247, b: 242 },
    },
  })
    .webp({ quality: 85 })
    .toBuffer();
}

async function generateBanner(ville: VilleData, dryRun: boolean): Promise<string> {
  const outputSlug = `axion-ia-${ville.slug}-formation-ia-banniere`;
  const outputPath = path.join(OUTPUT_DIR, `${outputSlug}.webp`);

  if (dryRun) {
    console.log(`[dry-run] Would generate: ${outputSlug}.webp`);
    return outputSlug;
  }

  // Tenter de lire le template, fallback sur fond uni
  let baseBuffer: Buffer;
  try {
    baseBuffer = await fs.readFile(TEMPLATE_PATH);
  } catch {
    console.warn(
      `[city-images-tier2] Template absent (${TEMPLATE_PATH}) — utilisation fond uni`,
    );
    baseBuffer = await buildFallbackBackground();
  }

  const svgOverlay = buildSvgOverlay(ville);

  await sharp(baseBuffer)
    .resize(BANNER_W, BANNER_H, { fit: "cover", position: "attention" })
    .composite([{ input: svgOverlay, gravity: "northwest" }])
    .webp({ quality: 85 })
    .toFile(outputPath);

  return outputSlug;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const slugFilter = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

  console.log(
    `\n[city-images-tier2] Génération bannières Tier 2 (${TIER2_MIN / 1000}K–${TIER2_MAX / 1000}K hab.)`,
  );
  if (dryRun) console.log("[city-images-tier2] Mode DRY-RUN — aucun fichier écrit\n");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const allVilles = await loadAllVilles();
  let tier2 = allVilles.filter(
    (v) => v.population >= TIER2_MIN && v.population <= TIER2_MAX,
  );

  if (slugFilter) {
    tier2 = tier2.filter((v) => v.slug === slugFilter);
    if (tier2.length === 0) {
      console.error(
        `[city-images-tier2] Aucune ville Tier 2 avec slug "${slugFilter}". Population range: ${TIER2_MIN}-${TIER2_MAX}.`,
      );
      process.exit(1);
    }
  }

  // Tri par population décroissante
  tier2.sort((a, b) => b.population - a.population);

  console.log(`[city-images-tier2] ${tier2.length} ville(s) à traiter\n`);

  let success = 0;
  let errors = 0;
  const failedSlugs: string[] = [];

  for (const ville of tier2) {
    try {
      const slug = await generateBanner(ville, dryRun);
      if (!dryRun) console.log(`✓ ${ville.nameFr} (pop. ${ville.population.toLocaleString("fr-FR")}) → ${slug}.webp`);
      success++;
    } catch (err) {
      console.error(`✗ ${ville.nameFr}: ${err instanceof Error ? err.message : String(err)}`);
      failedSlugs.push(ville.slug);
      errors++;
    }
  }

  console.log(
    `\n[city-images-tier2] Terminé — ${success} succès, ${errors} erreur(s)`,
  );
  if (failedSlugs.length > 0) {
    console.log(`[city-images-tier2] Échecs : ${failedSlugs.join(", ")}`);
  }

  // Exit code non-zero si au moins une erreur
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[city-images-tier2] Fatal:", err);
  process.exit(1);
});
