// Script de génération AVIF/WebP variants pour les illustrations Axion-IA.
//
// Sprint perfection images cross-site 2026-05-28 (Will validation). Génère
// les variants AVIF + WebP manquants pour les fichiers .png/.jpg/.jpeg dans
// les dossiers `/public/illustrations/**`. Skip si les 2 variants existent
// déjà.
//
// Best practices mai 2026 :
//  - AVIF quality 82, effort 6 (meilleure compression vs WebP, support Chrome
//    97+ / Safari 16+ / Firefox 113+ / Edge 117+)
//  - WebP quality 85 (fallback universel, support depuis 2010)
//  - PNG/JPG original conservé en source (le pipeline Next.js Image les sert
//    en AVIF/WebP au runtime via la négociation Accept)
//
// Usage : pnpm tsx scripts/generate-image-variants.ts

import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const TARGET_DIRS = ["public/illustrations", "public/illustrations/formations"];

const AVIF_QUALITY = 82;
const AVIF_EFFORT = 6;
const WEBP_QUALITY = 85;

const SOURCE_EXTENSIONS = /\.(png|jpg|jpeg)$/i;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function processDir(dir: string): Promise<{ generated: number; skipped: number }> {
  let generated = 0;
  let skipped = 0;

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    console.log(`⚠ SKIP DIR: ${dir} (not found)`);
    return { generated, skipped };
  }

  const sourceFiles = entries.filter((f) => SOURCE_EXTENSIONS.test(f));

  for (const file of sourceFiles) {
    const baseName = path.parse(file).name;
    const sourcePath = path.join(dir, file);
    const avifPath = path.join(dir, `${baseName}.avif`);
    const webpPath = path.join(dir, `${baseName}.webp`);

    const [avifExists, webpExists] = await Promise.all([
      fileExists(avifPath),
      fileExists(webpPath),
    ]);

    if (avifExists && webpExists) {
      console.log(`✓ SKIP: ${file} (AVIF + WebP existent)`);
      skipped += 1;
      continue;
    }

    try {
      const buffer = await fs.readFile(sourcePath);

      if (!avifExists) {
        await sharp(buffer).avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT }).toFile(avifPath);
        console.log(`✓ AVIF: ${dir}/${baseName}.avif`);
      }
      if (!webpExists) {
        await sharp(buffer).webp({ quality: WEBP_QUALITY }).toFile(webpPath);
        console.log(`✓ WEBP: ${dir}/${baseName}.webp`);
      }
      generated += 1;
    } catch (err) {
      console.error(`✗ ERROR: ${file} —`, err);
    }
  }

  return { generated, skipped };
}

async function main() {
  console.log(`🎨 Image variants generation — Sprint perfection 2026-05-28\n`);

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const dir of TARGET_DIRS) {
    console.log(`\n📁 ${dir}`);
    const { generated, skipped } = await processDir(dir);
    totalGenerated += generated;
    totalSkipped += skipped;
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Total : ${totalGenerated} fichiers convertis, ${totalSkipped} déjà OK`);
}

main().catch((err) => {
  console.error("✗ FATAL:", err);
  process.exit(1);
});
