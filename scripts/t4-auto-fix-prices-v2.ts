/**
 * t4-auto-fix-prices-v2.ts — Audit Will 2026-05-27 (round 2).
 *
 * Le round 1 (`t4-auto-fix-prices.ts`) couvrait surtout "490/590 € HT".
 * Round 2 élargit aux prix gpt-4o-generated 690/890/990/1490/1990/2990 € HT
 * dans les pitch/directAnswer/ecosystem (NOT servicesContext, NOT FAQ).
 *
 * Le scan low-quality a identifié 565 villes encore problématiques après
 * round 1 dont la majorité ont des prix > 490 dans le pitch/directAnswer.
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

const ALL_PRICES = "(490|590|690|890|990|1490|1990|2990|3490|3990|4990)";

const REPLACEMENTS: ReadonlyArray<{ from: RegExp; to: string }> = [
  // "à partir de X € HT pour ..." → ""
  { from: new RegExp(`\\s*à partir de ${ALL_PRICES}\\s*€\\s*HT[^.,]*?(pour|avec|et|en)`, "gi"), to: " $1" },
  { from: new RegExp(`\\s*à partir de ${ALL_PRICES}\\s*€\\s*HT`, "gi"), to: "" },
  { from: new RegExp(`\\s*dès ${ALL_PRICES}\\s*€\\s*HT`, "gi"), to: "" },
  { from: new RegExp(`\\s*\\(${ALL_PRICES}\\s*€\\s*HT\\)`, "gi"), to: "" },
  { from: new RegExp(`,?\\s*tarif d'entrée\\s*${ALL_PRICES}\\s*€\\s*HT`, "gi"), to: "" },
  // "X € HT pour ..." standalone
  { from: new RegExp(`\\b${ALL_PRICES}\\s*€\\s*HT[,.]?\\s*`, "gi"), to: "" },
];

function cleanup(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,.])([A-Za-zÀ-ÿ])/g, "$1 $2")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s+$/g, ".")
    .replace(/^\s+/, "")
    .trim();
}

function fixContent(content: string): { newContent: string; changes: number } {
  let changes = 0;
  let newContent = content;
  const targets = ["pitchFr", "pitchEn", "directAnswerFr", "directAnswerEn", "ecosystemFr", "ecosystemEn"];

  for (const field of targets) {
    const pattern = new RegExp(`(${field}:\\s*\\n?\\s*")([^"]+)(")`, "g");
    newContent = newContent.replace(pattern, (_match, prefix, body, suffix) => {
      let newBody = body;
      for (const r of REPLACEMENTS) {
        const before = newBody;
        newBody = newBody.replace(r.from, r.to);
        if (before !== newBody) changes++;
      }
      newBody = cleanup(newBody);
      return `${prefix}${newBody}${suffix}`;
    });
  }
  return { newContent, changes };
}

async function main() {
  const files = (await fs.readdir(COPY_DIR)).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["types.ts", "_auto-generated-index.ts", "index.ts", "resolve-with-copy.ts"].includes(f),
  );

  let filesModified = 0;
  let totalChanges = 0;

  for (const file of files) {
    const filepath = path.join(COPY_DIR, file);
    const content = await fs.readFile(filepath, "utf-8");
    const { newContent, changes } = fixContent(content);

    if (changes > 0 && newContent !== content) {
      await fs.writeFile(filepath, newContent, "utf-8");
      filesModified++;
      totalChanges += changes;
    }
  }

  console.log(`[auto-fix-prices-v2] Files modified: ${filesModified}/${files.length}`);
  console.log(`[auto-fix-prices-v2] Total replacements: ${totalChanges}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
