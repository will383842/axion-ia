/**
 * Conversion complète des 72 images marketing Axion-IA
 * Source : C:\...\Images Axion-IA\
 * Cible  : axionia\public\images\{slug}.webp + {slug}.avif
 *
 * Usage : node scripts/image-bank-convert-all.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MANIFEST_PATH = path.resolve(
  __dirname,
  "../../_AUDIT/image-bank-complet-2026/00-rename-manifest.json",
);
const SOURCE_ROOT = path.resolve(__dirname, "../../Images Axion-IA");
const OUT_DIR = path.resolve(__dirname, "../public/images");

const WEBP_QUALITY = 85;
const AVIF_QUALITY = 65;
const LOGO_WEBP_LOSSLESS = true; // logos → WebP lossless (préserve transparence)

// Mapping source -> dossier réel
const FOLDER_MAP = {
  Audit: "Audit",
  "Formations & Interventions": "Formations & Interventions",
  "Automatisations et implémentations": "Automatisations et implémentations",
  "1 TO 1/Dirigeant 1 TO 1": path.join("1 TO 1", "Dirigeant 1 TO 1"),
  "1 TO 1/Membre d'équipe 1 TO 1": path.join("1 TO 1", "Membre d'équipe 1 TO 1"),
  "Graphiques et courbes": "Graphiques et courbes",
  Logos: "Logos",
  "Tous types de propositions": "Tous types de propositions",
  Villes: "Villes",
};

function findSourceFile(sourceFolder, sourceName) {
  const folderRel = FOLDER_MAP[sourceFolder] ?? sourceFolder;

  // Villes : source peut être "Paris/16_08_59.png" ou "Lyon/17_38_21.png"
  if (sourceFolder === "Villes" && sourceName.includes("/")) {
    const parts = sourceName.split("/");
    const subFolder = parts[0];
    const timeStr = parts[1]; // "16_08_59.png"
    const dir = path.join(SOURCE_ROOT, "Villes", subFolder);
    return findByTimeOrExact(dir, timeStr);
  }

  const dir = path.join(SOURCE_ROOT, folderRel);

  // Logos : source = nom de fichier direct (avec possible ellipsis "...")
  if (sourceFolder === "Logos") {
    return findLogo(dir, sourceName);
  }

  // Autres : source = "HH_MM_SS.png", fichier réel = "ChatGPT Image 19 mai 2026, HH_MM_SS.png"
  return findByTimeOrExact(dir, sourceName);
}

function findByTimeOrExact(dir, sourceName) {
  // 1. Essai direct
  const direct = path.join(dir, sourceName);
  if (fs.existsSync(direct)) return direct;

  // 2. Préfixe "ChatGPT Image 19 mai 2026, "
  const withPrefix = path.join(dir, `ChatGPT Image 19 mai 2026, ${sourceName}`);
  if (fs.existsSync(withPrefix)) return withPrefix;

  // 3. Recherche par suffix (gère encodage/espaces)
  try {
    const files = fs.readdirSync(dir);
    const match = files.find((f) => f.endsWith(`, ${sourceName}`) || f === sourceName);
    if (match) return path.join(dir, match);
  } catch {}

  return null;
}

function findLogo(dir, sourceName) {
  // 1. Exact match
  const exact = path.join(dir, sourceName);
  if (fs.existsSync(exact)) return exact;

  // 2. Double extension (.png.png)
  const doubleExt = path.join(dir, sourceName.replace(/\.png$/, ".png.png"));
  if (fs.existsSync(doubleExt)) return doubleExt;

  // 3. Ellipsis dans sourceName → chercher par début + fin
  if (sourceName.includes("...")) {
    const [before, after] = sourceName.split("...");
    const beforeClean = before.trim();
    const afterClean = after?.trim() ?? "";
    try {
      const files = fs.readdirSync(dir);
      const match = files.find((f) => {
        const base = f.replace(/\.png$/, "").replace(/\.png$/, ""); // retire double ext
        return (
          base.startsWith(beforeClean) &&
          (!afterClean || base.endsWith(afterClean.replace(/\.png$/, "")))
        );
      });
      if (match) return path.join(dir, match);
    } catch {}
  }

  // 4. Contient le nom
  try {
    const files = fs.readdirSync(dir);
    const baseName = sourceName.replace(/\.png$/i, "").toLowerCase();
    const match = files.find((f) =>
      f
        .toLowerCase()
        .replace(/\.png$/i, "")
        .replace(/\.png$/i, "")
        .includes(baseName.split("...")[0].trim()),
    );
    if (match) return path.join(dir, match);
  } catch {}

  return null;
}

async function convertImage(srcPath, slug, isLogo) {
  const outWebP = path.join(OUT_DIR, `${slug}.webp`);
  const outAvif = path.join(OUT_DIR, `${slug}.avif`);

  // Ignorer si déjà converti
  if (fs.existsSync(outWebP) && fs.existsSync(outAvif)) {
    return { slug, status: "SKIP (already exists)" };
  }
  if (fs.existsSync(outWebP) && isLogo) {
    return { slug, status: "SKIP (logo already exists)" };
  }

  try {
    const img = sharp(srcPath);
    const meta = await img.metadata();

    // WebP
    if (isLogo) {
      await img.clone().webp({ lossless: LOGO_WEBP_LOSSLESS, quality: 90 }).toFile(outWebP);
    } else {
      await img.clone().webp({ quality: WEBP_QUALITY }).toFile(outWebP);
    }

    // AVIF (skip logos — transparence problématique en AVIF)
    if (!isLogo) {
      await img.clone().avif({ quality: AVIF_QUALITY }).toFile(outAvif);
    }

    const webpSize = fs.statSync(outWebP).size;
    return {
      slug,
      status: "OK",
      format: meta.format,
      w: meta.width,
      h: meta.height,
      webpKB: Math.round(webpSize / 1024),
    };
  } catch (err) {
    return { slug, status: `ERROR: ${err.message}`, src: srcPath };
  }
}

async function main() {
  // Créer le dossier de sortie si nécessaire
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const raw = fs.readFileSync(MANIFEST_PATH, "utf8").replace(/^﻿/, "");
  const manifest = JSON.parse(raw);

  console.log(`\n🚀 Conversion de ${manifest.length} images Axion-IA`);
  console.log(`   Source : ${SOURCE_ROOT}`);
  console.log(`   Cible  : ${OUT_DIR}\n`);

  const results = [];
  let ok = 0,
    skip = 0,
    errors = 0,
    notFound = 0;

  for (const entry of manifest) {
    const srcPath = findSourceFile(entry.sourceFolder, entry.source);
    const isLogo = entry.category === "logos";

    if (!srcPath) {
      const result = {
        id: entry.id,
        slug: entry.targetSlug,
        status: `NOT_FOUND (${entry.sourceFolder}/${entry.source})`,
      };
      results.push(result);
      console.log(`❌ [${entry.id}] NOT FOUND — ${entry.sourceFolder}/${entry.source}`);
      notFound++;
      continue;
    }

    const result = await convertImage(srcPath, entry.targetSlug, isLogo);
    result.id = entry.id;
    results.push(result);

    if (result.status.startsWith("OK")) {
      console.log(
        `✅ [${entry.id}] ${entry.targetSlug.substring(0, 55)} — ${result.webpKB}KB WebP`,
      );
      ok++;
    } else if (result.status.startsWith("SKIP")) {
      console.log(`⏭️  [${entry.id}] ${entry.targetSlug.substring(0, 55)} — ${result.status}`);
      skip++;
    } else {
      console.log(`❌ [${entry.id}] ${entry.targetSlug.substring(0, 55)} — ${result.status}`);
      errors++;
    }
  }

  console.log(`\n📊 Résultats :`);
  console.log(`   ✅ Convertis  : ${ok}`);
  console.log(`   ⏭️  Déjà faits : ${skip}`);
  console.log(`   ❌ Non trouvés: ${notFound}`);
  console.log(`   💥 Erreurs    : ${errors}`);
  console.log(`   📁 Total      : ${manifest.length}`);

  // Rapport JSON
  const reportPath = path.resolve(
    __dirname,
    "../../_AUDIT/image-bank-complet-2026/14-conversion-report.json",
  );
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );
  console.log(`\n📄 Rapport : ${reportPath}`);

  if (errors > 0 || notFound > 0) {
    console.log("\n⚠️  Des images n'ont pas été converties. Vérifier le rapport.");
    process.exit(1);
  }
  console.log("\n🎉 Conversion terminée avec succès !");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
