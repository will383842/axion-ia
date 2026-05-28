/**
 * t4-variationize-v2.ts — Audit Will 2026-05-27 (round 2).
 *
 * Variationise les phrases NOUVELLES top boilerplate identifiées après le
 * 1er passage (qui avait éclaté en 8 variantes les phrases originales).
 *
 * Cibles round 2 (200+ villes chacune) :
 *   - "Quel est le tarif d'un audit IA à [Ville]" (400 villes — FAQ standard, normal)
 *   - 8 variantes "Audit Flash X" (200-285 villes chacune)
 *   - "L'audit Flash démarre à 490 € HT" (198 villes)
 *
 * Stratégie : éclater chaque variante en 4 SUR-variantes (32 total au lieu de 8).
 *
 * Le hash slug + variant key garantit assignment déterministe et stable.
 */
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

const VARIATIONS: ReadonlyArray<{ from: RegExp; to: ReadonlyArray<string> }> = [
  // Q FAQ tarif — variationiser pour casser 400 villes
  {
    from: /"Quel est le tarif d'un audit IA à ([^"?]+)\s*\?"/g,
    to: [
      `"Quel est le tarif d'un audit IA à $1 ?"`,
      `"Combien coûte un audit IA à $1 ?"`,
      `"Tarifs audit IA à $1 : quel budget prévoir ?"`,
      `"Quel est le prix d'un audit IA pour entreprises à $1 ?"`,
    ],
  },
  // Variantes Audit Flash — sur-variationiser
  {
    from: /ROI chiffré, audit Flash sur mesure/g,
    to: [
      "ROI chiffré, audit Flash adapté à votre activité",
      "ROI quantifié, audit Flash personnalisé",
      "ROI documenté en chiffres, audit Flash sur mesure",
      "Retour sur investissement chiffré, audit Flash adapté",
    ],
  },
  {
    from: /Audit Flash sur mesure avec ROI quantifié/g,
    to: [
      "Audit Flash personnalisé avec ROI quantifié",
      "Audit Flash adapté avec ROI mesuré",
      "Audit Flash sur mesure avec retour chiffré",
      "Audit Flash contextualisé avec ROI démontré",
    ],
  },
  {
    from: /Axion-IA accompagne entreprises et indépendants de tous secteurs/g,
    to: [
      "Axion-IA accompagne entreprises et indépendants",
      "Axion-IA collabore avec toutes les structures locales",
      "Axion-IA répond aux besoins de toutes les entreprises",
      "Axion-IA opère pour entreprises et indépendants du secteur",
    ],
  },
  {
    from: /Axion-IA y déploie ses missions auprès de toutes les organisations/g,
    to: [
      "Axion-IA y mène ses missions auprès des organisations locales",
      "Axion-IA y déploie son expertise pour toutes les organisations",
      "Axion-IA y travaille avec les organisations du territoire",
      "Axion-IA y conduit ses missions auprès des entreprises locales",
    ],
  },
  {
    from: /Axion-IA couvre l'ensemble des activités professionnelles présentes/g,
    to: [
      "Axion-IA couvre les activités professionnelles du bassin",
      "Axion-IA opère sur l'ensemble des activités professionnelles locales",
      "Axion-IA accompagne tout le tissu professionnel local",
      "Axion-IA répond aux besoins des activités professionnelles présentes",
    ],
  },
  {
    from: /L'audit Flash démarre à 490\s*€\s*HT/g,
    to: [
      "L'audit Flash est tarifé selon vos enjeux",
      "L'audit Flash s'adapte à votre périmètre",
      "L'audit Flash débute selon la taille de votre activité",
      "L'audit Flash propose un tarif d'entrée accessible",
    ],
  },
];

function hashSlugToBucket(slug: string, salt: string, n: number): number {
  const h = createHash("md5")
    .update(slug + salt)
    .digest("hex");
  return parseInt(h.substring(0, 8), 16) % n;
}

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts"].includes(f),
  );

  let filesChanged = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const slug = file.replace(/\.ts$/, "");
    const filepath = path.join(COPY_DIR, file);
    let content = await fs.readFile(filepath, "utf-8");
    let fileChanges = 0;

    for (let i = 0; i < VARIATIONS.length; i++) {
      const variation = VARIATIONS[i]!;
      const salt = `v2-${i}`;
      const bucket = hashSlugToBucket(slug, salt, variation.to.length);
      const target = variation.to[bucket]!;

      // Pour les patterns avec capture group, on reconstruit la string
      const before = content;
      content = content.replace(variation.from, target);
      const matches = (before.match(variation.from) || []).length;
      if (matches > 0 && before !== content) {
        fileChanges += matches;
      }
    }

    if (fileChanges > 0) {
      await fs.writeFile(filepath, content, "utf-8");
      filesChanged++;
      totalReplacements += fileChanges;
    }
  }

  console.log(`[variationize-v2] Files modified: ${filesChanged}/${files.length}`);
  console.log(`[variationize-v2] Total replacements: ${totalReplacements}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
