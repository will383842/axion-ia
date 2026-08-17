#!/usr/bin/env node
/**
 * Régénère `src/lib/vcard/photo.ts` — le portrait embarqué dans la vCard.
 *
 * La vCard doit rester lisible hors ligne : on embarque le JPEG en base64
 * plutôt que d'y mettre une URL. 400×400 en qualité 72 pèse ~15 Ko, soit
 * ~20 Ko une fois encodé — négligeable pour un téléchargement, et bien assez
 * pour la vignette qu'affiche le carnet d'adresses.
 *
 * Usage :  node scripts/build-vcard-photo.cjs
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(
  ROOT,
  "public/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg",
);
const TARGET = path.join(ROOT, "src/lib/vcard/photo.ts");

const SIZE = 400;
const QUALITY = 72;

async function main() {
  const jpeg = await sharp(SOURCE)
    .resize(SIZE, SIZE, { fit: "cover" })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer();

  const base64 = jpeg.toString("base64");
  const chunks = base64
    .match(/.{1,76}/g)
    .map((c) => `  "${c}",`)
    .join("\n");

  const header = [
    "// Portrait de Williams Jullin embarqué dans la vCard, en base64.",
    "//",
    "// GÉNÉRÉ — ne pas éditer à la main. Régénération :",
    "//   node scripts/build-vcard-photo.cjs",
    "//",
    "// Source : public/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg",
    `// Sortie  : JPEG ${SIZE}×${SIZE}, qualité ${QUALITY} (mozjpeg) — ${jpeg.length} octets.`,
    "//",
    "// Embarquée plutôt que liée : une vCard doit rester lisible hors ligne, et un",
    "// contact enregistré ne doit pas dépendre de la disponibilité du site. Ce",
    "// module n'est importé que par une route serveur : il n'entre dans aucun",
    "// bundle client, donc il ne pèse sur aucun budget Web Vitals.",
    "",
    "/** Portrait JPEG en base64, découpé pour rester lisible en revue. */",
  ].join("\n");

  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(
    TARGET,
    `${header}\nconst CHUNKS = [\n${chunks}\n] as const;\n\nexport const PHOTO_JPEG_BASE64 = CHUNKS.join("");\n`,
    "utf8",
  );

  console.log(`${path.relative(ROOT, TARGET)} — ${jpeg.length} octets, ${base64.length} car.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
