/**
 * t4-find-low-quality.ts — Audit Will 2026-05-27.
 *
 * Scan exhaustif des 2157 fichiers VilleCopy pour identifier ceux qui sont
 * problématiques (faible qualité, peu de différenciation, tarifs hardcodés).
 *
 * Critères de détection :
 *   - Auto-généré gpt-4o avec quality score < 75 (header)
 *   - Concat pitch+directAnswer+ecosystem+distances < 800 chars
 *   - Présence de tarif hardcodé "490 € HT" ou "590 € HT" dans pitch/directAnswer/ecosystem
 *     (Note : Audit Flash 490 € HT est OK dans servicesContext + FAQ — c'est la pricing
 *     centralisée. Le pb c'est quand c'est dans le contenu principal hors structure.)
 *   - topSectorsNaf 100% générique (5 secteurs dans la liste blacklist)
 *
 * Output : `_AUDIT/VILLES-T4-PROGRESS/low-quality-villes.json`
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");
const OUTPUT_FILE = path.join(
  process.cwd(),
  "_AUDIT",
  "VILLES-T4-PROGRESS",
  "low-quality-villes.json",
);

const GENERIC_SECTORS = [
  "tpe artisanat btp",
  "tpe artisanat",
  "pme tertiaires",
  "pme tertiaires services",
  "commerce de proximité",
  "commerce proximité",
  "services aux entreprises",
  "professions libérales",
  "commerce de détail",
  "commerce détail",
  "restauration",
  "programmation informatique",
  "activités créatives",
  "hébergement",
  "services",
  "artisanat",
];

interface VilleProblem {
  slug: string;
  qualityScore: number | null;
  model: string | null;
  charsUnique: number;
  hasHardcodedPrices: boolean;
  genericSectorsCount: number;
  totalSectors: number;
  issues: string[];
}

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts"].includes(f),
  );

  const problematic: VilleProblem[] = [];
  let total = 0;

  for (const file of files) {
    const slug = file.replace(/\.ts$/, "");
    const filepath = path.join(COPY_DIR, file);
    const content = await fs.readFile(filepath, "utf-8");
    total++;

    const issues: string[] = [];

    // Détection quality score gpt-4o
    const qsMatch = content.match(/Quality score:\s*(\d+)\s*—\s*Model:\s*(\S+)/);
    const qualityScore = qsMatch ? parseInt(qsMatch[1]!, 10) : null;
    const model = qsMatch ? qsMatch[2]! : null;

    if (qualityScore !== null && qualityScore < 75) {
      issues.push(`Quality score gpt-4o = ${qualityScore} (<75)`);
    }

    // Détection chars uniques
    const pitchFr = (content.match(/pitchFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
    const directAnswerFr = (content.match(/directAnswerFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
    const ecosystemFr = (content.match(/ecosystemFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
    const distancesFr = (content.match(/distancesFr:\s*\n?\s*"([^"]+)"/) || [])[1] || "";
    const concat = pitchFr + " " + directAnswerFr + " " + ecosystemFr + " " + distancesFr;
    const charsUnique = concat.length;

    if (charsUnique < 800) {
      issues.push(`Chars uniques = ${charsUnique} (<800)`);
    }

    // Détection tarifs hardcodés (uniquement dans pitch/directAnswer/ecosystem)
    const priceRegex = /\b(490|590|690|890|990|1490|1990|2990)\s*€\s*HT\b/i;
    const hasHardcodedPrices =
      priceRegex.test(pitchFr) || priceRegex.test(directAnswerFr) || priceRegex.test(ecosystemFr);
    if (hasHardcodedPrices) {
      issues.push("Tarifs hardcodés dans pitch/directAnswer/ecosystem");
    }

    // Détection topSectorsNaf génériques
    const sectorsMatch = content.match(/topSectorsNaf:\s*\[([\s\S]*?)\]/);
    const sectorsRaw = sectorsMatch ? sectorsMatch[1]! : "";
    const sectors = Array.from(sectorsRaw.matchAll(/"([^"]+)"/g)).map((m) => m[1]!);
    const genericSectorsCount = sectors.filter((s) =>
      GENERIC_SECTORS.includes(s.toLowerCase().trim()),
    ).length;

    if (genericSectorsCount >= 3) {
      issues.push(`${genericSectorsCount}/${sectors.length} secteurs génériques`);
    }

    if (issues.length > 0) {
      problematic.push({
        slug,
        qualityScore,
        model,
        charsUnique,
        hasHardcodedPrices,
        genericSectorsCount,
        totalSectors: sectors.length,
        issues,
      });
    }
  }

  // Sort by severity (most issues first)
  problematic.sort((a, b) => b.issues.length - a.issues.length);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      {
        scannedAt: new Date().toISOString(),
        totalVilles: total,
        problematicCount: problematic.length,
        problematic,
      },
      null,
      2,
    ),
    "utf-8",
  );

  console.log(`[low-quality] Scanned: ${total} files`);
  console.log(`[low-quality] Problematic: ${problematic.length}`);
  console.log(`[low-quality] Output: ${OUTPUT_FILE}`);
  console.log("\nTop 10 most problematic villes:");
  for (const p of problematic.slice(0, 10)) {
    console.log(
      `  - ${p.slug}: ${p.issues.length} issues — ${p.issues.join(", ")} (chars=${p.charsUnique}, qs=${p.qualityScore ?? "N/A"})`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
