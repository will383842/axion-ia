/**
 * process-villes-hero-images.ts — Audit Will 2026-05-27.
 *
 * Convertit les 58 photos hero ville PNG (1.8-2.6 MB chacune) en :
 *   - AVIF 1200×1200 (~70-90 KB, format optimal LCP)
 *   - WebP 1200×1200 (~110-140 KB, fallback Safari < 16)
 *   - JPG 1200×1200 (~150-180 KB, fallback ultime)
 *
 * Stocke dans `public/villes-hero/{slug}.{avif|webp|jpg}`.
 * Slug = nom fichier lowercase, "Hub_ville_X.png" → "x", underscores→dashes.
 *
 * Génère également `src/content/villes/hero-images-map.ts` qui exporte
 * un Set des slugs ayant une image custom, utilisé par page.tsx pour
 * basculer hero universel ↔ hero ville-spécifique.
 */
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const SOURCE_DIR = "C:\\Users\\willi\\Downloads\\photo héro par ville";
const OUTPUT_DIR = path.join(process.cwd(), "public", "villes-hero");
const MAP_FILE = path.join(
  process.cwd(),
  "src",
  "content",
  "villes",
  "hero-images-map.ts",
);

const SIZE = 1200;
const AVIF_QUALITY = 60;
const WEBP_QUALITY = 78;
const JPG_QUALITY = 80;

function nameToSlug(filename: string): string {
  // "Hub_ville_Aix-en-Provence.png" → "aix-en-provence"
  // "Hub_ville_Saint-Etienne.png" → "saint-etienne"
  // "Hub_ville_Montélimar.png" → "montelimar"
  // "Hub_ville_Le_Mans.png" → "le-mans"
  let s = filename
    .replace(/^Hub_ville_/, "")
    .replace(/\.(png|jpg|jpeg|webp)$/i, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/_/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .trim();
  return s;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const files = (await fs.readdir(SOURCE_DIR)).filter((f) =>
    /\.(png|jpg|jpeg|webp)$/i.test(f),
  );

  const slugs: string[] = [];
  let processed = 0;
  let errors = 0;

  for (const file of files) {
    const slug = nameToSlug(file);
    const sourcePath = path.join(SOURCE_DIR, file);

    try {
      const buffer = await fs.readFile(sourcePath);
      const base = sharp(buffer).resize(SIZE, SIZE, {
        fit: "cover",
        position: "centre",
      });

      // AVIF (best compression, mais slow encode)
      await base
        .clone()
        .avif({ quality: AVIF_QUALITY, effort: 6 })
        .toFile(path.join(OUTPUT_DIR, `${slug}.avif`));

      // WebP (fallback Safari)
      await base
        .clone()
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toFile(path.join(OUTPUT_DIR, `${slug}.webp`));

      // JPG (fallback ultime, qualité 80)
      await base
        .clone()
        .jpeg({ quality: JPG_QUALITY, progressive: true, mozjpeg: true })
        .toFile(path.join(OUTPUT_DIR, `${slug}.jpg`));

      slugs.push(slug);
      processed++;

      // Stats poids
      const avifSize = (await fs.stat(path.join(OUTPUT_DIR, `${slug}.avif`))).size;
      const webpSize = (await fs.stat(path.join(OUTPUT_DIR, `${slug}.webp`))).size;
      console.log(
        `[${processed}/${files.length}] ${slug} — AVIF ${Math.round(avifSize / 1024)} KB / WebP ${Math.round(webpSize / 1024)} KB`,
      );
    } catch (err) {
      console.error(`[ERROR] ${file}:`, err);
      errors++;
    }
  }

  // Génère le fichier TypeScript map
  slugs.sort();
  const mapContent = `// AUTO-GENERATED 2026-05-27 — Audit Will images hero villes.
// Set des slugs villes qui ont une image hero custom dans \`public/villes-hero/\`.
// Utilisé par \`src/app/[locale]/implantations/[region]/[ville]/page.tsx\`
// pour basculer entre hero universel (placeholder) et hero ville-spécifique.
//
// Pour ajouter une nouvelle ville : déposer 3 fichiers (avif/webp/jpg) dans
// \`public/villes-hero/{slug}.{format}\` puis ajouter le slug à la constante.
// Ou ré-exécuter \`pnpm tsx scripts/process-villes-hero-images.ts\`.

export const VILLES_WITH_HERO_IMAGE: ReadonlySet<string> = new Set([
${slugs.map((s) => `  "${s}",`).join("\n")}
]);

export function hasVilleHeroImage(slug: string): boolean {
  return VILLES_WITH_HERO_IMAGE.has(slug);
}
`;
  await fs.writeFile(MAP_FILE, mapContent, "utf-8");

  console.log(`\n[done] Processed ${processed}/${files.length} (errors: ${errors})`);
  console.log(`[done] Map file: ${MAP_FILE}`);
  console.log(`[done] ${slugs.length} villes avec hero custom.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
