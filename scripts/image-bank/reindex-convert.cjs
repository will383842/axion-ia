/**
 * Reindex banque d'images — conversion manifest-driven PNG/JPG → WebP + AVIF (+ thumb)
 *
 * Lit _AUDIT/image-bank-reindex-2026-07/00-rename-manifest.json (215 entrées validées)
 * et produit public/images/{targetSlug}.{webp,avif} + {targetSlug}-thumb.webp.
 *
 * Résolution source : par BASENAME (les basenames disque sont uniques → contourne
 * le mojibake des noms de dossiers dans le manifeste). Source hors worktree :
 *   C:/Users/willi/Documents/Projets/Axion-IA/Images Axion-IA
 *
 * Runtime : CJS + NODE_PATH vers le node_modules PRINCIPAL (jamais de jonction —
 * cf. mémoire worktree-node-modules-junction-danger). Invocation :
 *   NODE_PATH="<main>/node_modules" node scripts/image-bank/reindex-convert.cjs
 *
 * Idempotent : ré-exécutable, écrase les slugs existants. Ne SUPPRIME rien
 * (les orphelins sont rapportés séparément).
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const WT_ROOT = path.join(__dirname, "..", "..");
const MANIFEST = path.join(
  WT_ROOT,
  "_AUDIT/image-bank-reindex-2026-07/00-rename-manifest.json"
);
const SOURCE_ROOT = "C:/Users/willi/Documents/Projets/Axion-IA/Images Axion-IA";
const OUTPUT_DIR = path.join(WT_ROOT, "public/images");

const IVORY = { r: 250, g: 248, b: 243, alpha: 1 };

/** Dimensions/fit par type (manifest.type ∈ {photo, banniere, carre}). */
function plan(type) {
  switch (type) {
    case "banniere":
      // Bannières conçues 16:9 → cover strict.
      return { w: 1920, h: 1080, fit: "cover" };
    case "carre":
      // Visuels carrés → cover 1:1.
      return { w: 1200, h: 1200, fit: "cover" };
    case "photo":
    default:
      // Photos : préserver le ratio source, borner à 1600 (pas d'agrandissement).
      return { w: 1600, h: 1600, fit: "inside" };
  }
}

/** Index basename → chemin absolu (unicité vérifiée en amont). */
function buildDiskIndex(root) {
  const idx = new Map();
  const stack = [root];
  const exts = new Set([".png", ".jpg", ".jpeg"]);
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (exts.has(path.extname(ent.name).toLowerCase())) {
        idx.set(ent.name, full);
      }
    }
  }
  return idx;
}

async function convertOne(srcPath, slug, type) {
  const { w, h, fit } = plan(type);
  const base = path.join(OUTPUT_DIR, slug);

  const pipe = sharp(srcPath).resize(w, h, {
    fit,
    position: "centre",
    withoutEnlargement: fit === "inside",
    background: IVORY,
  });

  await pipe.clone().webp({ quality: 85 }).toFile(`${base}.webp`);
  await pipe.clone().avif({ quality: 60 }).toFile(`${base}.avif`);
  // Thumbnail : 400px de large, ratio préservé.
  await sharp(srcPath)
    .resize(400, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(`${base}-thumb.webp`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const disk = buildDiskIndex(SOURCE_ROOT);

  console.log(`Manifest : ${manifest.length} entrées · disque : ${disk.size} fichiers`);
  console.log(`Sortie   : ${OUTPUT_DIR}\n`);

  let ok = 0;
  const failed = [];
  for (const e of manifest) {
    const b = path.basename(e.source);
    const src = disk.get(b);
    if (!src) {
      failed.push(`${e.id} ${e.targetSlug} — source introuvable (${b})`);
      continue;
    }
    try {
      await convertOne(src, e.targetSlug, e.type);
      ok++;
      if (ok % 25 === 0) console.log(`  … ${ok}/${manifest.length}`);
    } catch (err) {
      failed.push(`${e.id} ${e.targetSlug} — ${err.message}`);
    }
  }

  console.log(`\n✅ Convertis : ${ok}/${manifest.length}`);
  if (failed.length) {
    console.log(`❌ Échecs : ${failed.length}`);
    failed.forEach((f) => console.log("   " + f));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
