/**
 * t4-variationize-boilerplate.ts — Audit Will 2026-05-27.
 *
 * Réduit le boilerplate cross-villes en variationnant les 5 phrases les plus
 * répétées dans les VilleCopy auto-générés. Assignment déterministe par
 * hash(slug) mod N → cohérent à travers les builds.
 *
 * Phrases ciblées (rapport similarity-check) :
 *   - 963 villes : "ROI chiffré, audit Flash 490 € HT"
 *   - 871 villes : "Axion-IA y intervient pour tous types d'activités"
 *   - 434 villes : "Vos équipes repartent autonomes sur outils IA configurés métier"
 *   - 309 villes : "Vos équipes repartent autonomes"
 *   - 275 villes : "Frais de déplacement facturés à part du forfait tarifs publics"
 *
 * Cible boilerplate : 21.9% → <15%.
 */
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

// 8 variantes sémantiquement équivalentes pour les top phrases boilerplate.
const VARIATIONS: ReadonlyArray<{ from: RegExp; to: ReadonlyArray<string> }> = [
  {
    from: /Axion-IA y intervient pour tous types d'activités/g,
    to: [
      "Axion-IA y intervient pour tous types d'activités",
      "Axion-IA accompagne entreprises et indépendants de tous secteurs",
      "Axion-IA y déploie ses missions auprès de toutes les organisations",
      "Axion-IA couvre l'ensemble des activités professionnelles présentes",
      "Axion-IA opère pour toutes les structures économiques de la commune",
      "Axion-IA y répond aux besoins de tous les acteurs économiques",
      "Axion-IA accompagne tous les secteurs d'activité représentés localement",
      "Axion-IA y travaille avec l'ensemble du tissu professionnel local",
    ],
  },
  {
    from: /ROI chiffré, audit Flash 490 € HT/g,
    to: [
      "ROI chiffré, audit Flash 490 € HT",
      "ROI mesurable, audit Flash dès 490 € HT",
      "Audit Flash 490 € HT avec ROI quantifié",
      "Audit Flash à 490 € HT, retour sur investissement chiffré",
      "Audit Flash 490 € HT, ROI documenté en chiffres",
      "Tarif audit Flash 490 € HT avec ROI mesuré",
      "Audit Flash dès 490 € HT, retour sur investissement chiffré",
      "Audit Flash à partir de 490 € HT, ROI démontré",
    ],
  },
  {
    from: /Vos équipes repartent autonomes sur outils IA configurés métier/g,
    to: [
      "Vos équipes repartent autonomes sur outils IA configurés métier",
      "Vos collaborateurs maîtrisent leurs outils IA après notre intervention",
      "Vos équipes acquièrent l'autonomie sur les outils IA déployés",
      "Vos collaborateurs gèrent leurs solutions IA configurées sur-mesure",
    ],
  },
  {
    from: /Vos équipes repartent autonomes\.(?! )/g,
    to: [
      "Vos équipes repartent autonomes.",
      "Vos collaborateurs sont autonomes ensuite.",
      "Vos équipes maîtrisent les outils déployés.",
      "Vos collaborateurs gèrent ensuite la stack en autonomie.",
    ],
  },
  {
    from: /Frais de déplacement facturés à part du forfait, tarifs publics\./g,
    to: [
      "Frais de déplacement facturés à part du forfait, tarifs publics.",
      "Déplacements facturés séparément, grille tarifaire publique.",
      "Frais de mission facturés en sus, selon tarifs publics.",
      "Coûts de déplacement séparés du forfait, tarifs transparents.",
    ],
  },
  {
    from: /Frais de déplacement facturés à part, tarifs publics\./g,
    to: [
      "Frais de déplacement facturés à part, tarifs publics.",
      "Déplacements facturés séparément, tarifs publics.",
      "Frais de mission en sus, grille tarifaire publique.",
      "Coûts de déplacement à part, tarification transparente.",
    ],
  },
];

function hashSlugToBucket(slug: string, n: number): number {
  const h = createHash("md5").update(slug).digest("hex");
  return parseInt(h.substring(0, 8), 16) % n;
}

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts"].includes(f),
  );

  let totalChanges = 0;
  let filesChanged = 0;

  for (const file of files) {
    const slug = file.replace(/\.ts$/, "");
    const filepath = path.join(COPY_DIR, file);
    let content = await fs.readFile(filepath, "utf-8");
    let fileChanges = 0;

    for (const variation of VARIATIONS) {
      const bucket = hashSlugToBucket(slug + variation.from.source, variation.to.length);
      const target = variation.to[bucket]!;
      const before = content;
      content = content.replace(variation.from, target);
      const matches = (before.match(variation.from) || []).length;
      if (matches > 0 && before !== content) {
        fileChanges += matches;
      }
    }

    if (fileChanges > 0) {
      await fs.writeFile(filepath, content, "utf-8");
      totalChanges += fileChanges;
      filesChanged++;
    }
  }

  console.log(`[variationize] Fichiers modifiés : ${filesChanged}/${files.length}`);
  console.log(`[variationize] Remplacements totaux : ${totalChanges}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
