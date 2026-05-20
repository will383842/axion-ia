/**
 * Conversion batch : PNG → WebP + AVIF → public/images/
 * + génération de l'OG image image-bank-hub.webp (1200×630)
 * Usage : node scripts/convert-images-batch.mjs
 */
import sharp from "sharp";
import { readdir, copyFile } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const SOURCE_DIR = "C:/Users/willi/Downloads/Images Axion-IA/Image 20052026";
const OUTPUT_DIR = join(PROJECT_ROOT, "public/images");
const OG_DIR = join(PROJECT_ROOT, "public/og");

/** Détermine les dimensions cibles selon le suffixe du slug */
function getDimensions(slug) {
  if (slug.endsWith("-banniere") || slug.includes("-banniere-"))
    return { w: 1920, h: 1080 };
  if (slug.endsWith("-carre") || slug.includes("-carre-"))
    return { w: 1200, h: 1200 };
  if (slug.endsWith("-affiche"))
    return { w: 1080, h: 1920 };
  if (slug.endsWith("-infographie"))
    return { w: 1200, h: 1600 };
  if (slug.endsWith("-editorial"))
    return { w: 1200, h: 800 };
  if (slug.endsWith("-dataviz"))
    return { w: 1200, h: 900 };
  if (slug.includes("-logo-") || slug.includes("-icone-"))
    return { w: 500, h: 200 };
  return { w: 1920, h: 1080 }; // fallback banniere
}

async function convertImage(srcPath, slug) {
  const { w, h } = getDimensions(slug);
  const base = join(OUTPUT_DIR, slug);
  const webpPath = `${base}.webp`;
  const avifPath = `${base}.avif`;
  const thumbPath = `${base}-thumb.webp`;

  const img = sharp(srcPath).resize(w, h, {
    fit: "cover",
    position: "centre",
    background: { r: 250, g: 248, b: 243, alpha: 1 },
  });

  await img.clone().webp({ quality: 85 }).toFile(webpPath);
  await img.clone().avif({ quality: 60 }).toFile(avifPath);
  // Thumbnail 400px large
  await sharp(srcPath)
    .resize(400, null, { fit: "inside" })
    .webp({ quality: 75 })
    .toFile(thumbPath);

  return { webpPath, avifPath, thumbPath };
}

async function createOGImage() {
  const outPath = join(OG_DIR, "image-bank-hub.webp");
  mkdirSync(OG_DIR, { recursive: true });

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#faf8f3"/>
      <stop offset="100%" stop-color="#f5f0e8"/>
    </linearGradient>
  </defs>

  <!-- Fond ivoire -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Bande terracotta gauche -->
  <rect x="0" y="0" width="12" height="630" fill="#c24a1b"/>

  <!-- Grille d'icônes images (décoratif) -->
  <rect x="720" y="40" width="200" height="150" rx="8" fill="#c24a1b" opacity="0.12"/>
  <rect x="940" y="40" width="240" height="150" rx="8" fill="#1a4dd9" opacity="0.08"/>
  <rect x="720" y="210" width="240" height="160" rx="8" fill="#c24a1b" opacity="0.08"/>
  <rect x="980" y="210" width="200" height="160" rx="8" fill="#c24a1b" opacity="0.15"/>
  <rect x="720" y="390" width="190" height="180" rx="8" fill="#1a4dd9" opacity="0.06"/>
  <rect x="930" y="390" width="250" height="180" rx="8" fill="#c24a1b" opacity="0.10"/>

  <!-- Icône grille (simulée) -->
  <rect x="730" y="50" width="58" height="43" rx="4" fill="#c24a1b" opacity="0.25"/>
  <rect x="798" y="50" width="58" height="43" rx="4" fill="#c24a1b" opacity="0.20"/>
  <rect x="866" y="50" width="58" height="43" rx="4" fill="#c24a1b" opacity="0.30"/>
  <rect x="730" y="100" width="58" height="43" rx="4" fill="#c24a1b" opacity="0.18"/>
  <rect x="798" y="100" width="58" height="43" rx="4" fill="#c24a1b" opacity="0.35"/>
  <rect x="866" y="100" width="58" height="43" rx="4" fill="#c24a1b" opacity="0.22"/>

  <rect x="950" y="50" width="70" height="55" rx="4" fill="#1a4dd9" opacity="0.12"/>
  <rect x="1030" y="50" width="70" height="55" rx="4" fill="#1a4dd9" opacity="0.18"/>
  <rect x="1110" y="50" width="70" height="55" rx="4" fill="#1a4dd9" opacity="0.10"/>
  <rect x="950" y="115" width="70" height="55" rx="4" fill="#1a4dd9" opacity="0.20"/>
  <rect x="1030" y="115" width="70" height="55" rx="4" fill="#1a4dd9" opacity="0.08"/>
  <rect x="1110" y="115" width="70" height="55" rx="4" fill="#1a4dd9" opacity="0.15"/>

  <!-- Ligne séparatrice -->
  <line x1="50" y1="480" x2="680" y2="480" stroke="#c24a1b" stroke-width="2" opacity="0.4"/>

  <!-- Logo Axion-IA texte -->
  <text x="50" y="140" font-family="Georgia, serif" font-size="28" font-weight="bold"
        fill="#c24a1b" letter-spacing="1">Axion-IA</text>
  <text x="50" y="165" font-family="Arial, sans-serif" font-size="14"
        fill="#888" letter-spacing="3">.com</text>

  <!-- Titre principal -->
  <text x="50" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="72"
        font-weight="bold" fill="#1a1a1a" letter-spacing="-1">Galerie</text>
  <text x="50" y="350" font-family="Georgia, 'Times New Roman', serif" font-size="72"
        font-weight="bold" fill="#c24a1b" letter-spacing="-1">Axion-IA</text>

  <!-- Sous-titre -->
  <text x="50" y="420" font-family="Arial, Helvetica, sans-serif" font-size="24"
        fill="#555" letter-spacing="0.5">Banque d'images professionnelles</text>
  <text x="50" y="452" font-family="Arial, Helvetica, sans-serif" font-size="24"
        fill="#555" letter-spacing="0.5">SEO · AEO · GEO · CC BY 4.0</text>

  <!-- Badge count -->
  <rect x="50" y="500" width="220" height="44" rx="22" fill="#c24a1b"/>
  <text x="160" y="527" font-family="Arial, Helvetica, sans-serif" font-size="16"
        font-weight="bold" fill="white" text-anchor="middle" letter-spacing="0.5">
    133 visuels libres de droits
  </text>

  <!-- URL bas de page -->
  <text x="50" y="610" font-family="Arial, Helvetica, sans-serif" font-size="15"
        fill="#999">axion-ia.com/fr/galerie</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .webp({ quality: 90 })
    .toFile(outPath);

  console.log("✅ OG image créée :", outPath);
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(OG_DIR, { recursive: true });

  // 1. OG image
  console.log("\n── Création OG image ──────────────────────────");
  await createOGImage();

  // 2. Conversion des 61 nouvelles images
  console.log("\n── Conversion PNG → WebP + AVIF ──────────────");
  const files = await readdir(SOURCE_DIR);
  const pngFiles = files.filter(
    (f) => f.startsWith("axion-ia-") && f.endsWith(".png")
  );

  console.log(`${pngFiles.length} fichiers PNG à convertir…\n`);

  let ok = 0, failed = 0;
  for (const file of pngFiles) {
    const slug = basename(file, ".png");
    const srcPath = join(SOURCE_DIR, file);
    try {
      await convertImage(srcPath, slug);
      console.log(`  ✓ ${slug}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${slug} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n── Récap : ${ok} convertis, ${failed} erreurs ──`);
  console.log(`── Fichiers dans : ${OUTPUT_DIR}`);
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
