// Localise les photos Unsplash de /visibilite-entreprise : télécharge chaque photo
// (déjà curée, CGU §6 déjà déclenché), la convertit en AVIF sous /public, et
// réécrit le manifeste `visibilite-entreprise-unsplash.ts` avec le chemin LOCAL.
// → les images sont désormais servies depuis axion-ia.com (indexables Google Images
// sous notre domaine + intégrables au manifeste page-images). L'attribution
// photographe (photographer/photographerUrl) est CONSERVÉE (<UnsplashCredit>).
//
// Usage : node scripts/localize-visibilite-unsplash.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TS = join(ROOT, "src/content/visibilite-entreprise-unsplash.ts");
const OUT_DIR = "public/illustrations/visibilite";

// slot → nom de fichier SEO (sans extension)
const NAMES = {
  hero: "equipe-entreprise-mise-en-lumiere-visibilite-axion-ia",
  podcast: "podcast-dirigeant-entreprise-visibilite-axion-ia",
  interview: "interview-participant-entreprise-visibilite-axion-ia",
  page: "page-dediee-entreprise-secteur-visibilite-axion-ia",
  backlink: "backlink-dofollow-autorite-seo-visibilite-axion-ia",
  linkedin: "relais-linkedin-entreprise-visibilite-axion-ia",
  notoriete: "notoriete-confiance-entreprise-visibilite-axion-ia",
};

const txt = readFileSync(TS, "utf8");
const m = txt.match(/=\s*(\[[\s\S]*\])\s*as const;/);
if (!m) throw new Error("Impossible d'extraire le tableau du manifeste");
// prettier retire les guillemets des clés (style TS) + laisse des virgules
// traînantes → on remet les guillemets et on retire les virgules pour JSON.parse.
const jsonish = m[1].replace(/^(\s*)([a-zA-Z_]\w*):/gm, '$1"$2":').replace(/,(\s*[}\]])/g, "$1");
const arr = JSON.parse(jsonish);

for (const item of arr) {
  const name = NAMES[item.slot] || `visibilite-${item.slot}-axion-ia`;
  const rel = `/illustrations/visibilite/${name}.avif`;
  // src déjà local ? on saute (idempotent).
  if (item.src.startsWith("/illustrations/")) {
    console.log(`[${item.slot}] déjà local, saut`);
    continue;
  }
  // télécharge en largeur ~1600 pour une bonne qualité
  const url = item.src.replace(/([?&])w=\d+/, "$1w=1600");
  console.log(`[${item.slot}] download ${item.photoId}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${item.slot} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const info = await sharp(buf)
    .resize({ width: 1600, withoutEnlargement: true })
    .avif({ quality: 60, effort: 4 })
    .toFile(join(ROOT, OUT_DIR, `${name}.avif`));
  item.src = rel;
  item.width = info.width;
  item.height = info.height;
  console.log(`  → ${rel} (${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)}KB)`);
}

// réécrit le fichier en conservant l'en-tête + l'interface
const head = txt.slice(0, txt.indexOf("export const VISIBILITE_UNSPLASH"));
const out = `${head}export const VISIBILITE_UNSPLASH: readonly VisibiliteUnsplashImage[] = ${JSON.stringify(arr, null, 2)} as const;\n`;
writeFileSync(TS, out, "utf8");
console.log(`\n✅ Manifeste réécrit avec ${arr.length} images LOCALES.`);
