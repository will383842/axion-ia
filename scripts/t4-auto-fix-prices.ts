/**
 * t4-auto-fix-prices.ts — Audit Will 2026-05-27.
 *
 * Retire les tarifs hardcodés "490 € HT" / "590 € HT" / "690 € HT" etc. de
 * pitch/directAnswer/ecosystem (le contenu narratif principal).
 *
 * Justification : la doctrine Will impose que les tarifs soient centralisés
 * dans `src/content/pricing.ts` et référencés via composants. Hardcoder
 * "Audit Flash 490 € HT" dans le pitchFr de 600 villes = (1) doctrine
 * violation, (2) risque obsolescence si tarif change, (3) signal "auto-gen
 * thin content" à Google.
 *
 * Stratégie : remplacer "à partir de 490 € HT" par "avec ROI chiffré" ou
 * "selon vos enjeux" selon le contexte. Garde les mentions dans
 * servicesContext et FAQ (légitimes car contextualisées).
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

const REPLACEMENTS: ReadonlyArray<{
  from: RegExp;
  to: string;
  field?: "pitch" | "directAnswer" | "ecosystem";
}> = [
  // Forme "Audit Flash à partir de 490 € HT" → "Audit Flash sur mesure"
  { from: /Audit Flash dès 490\s*€\s*HT/g, to: "Audit Flash sur mesure" },
  { from: /Audit Flash 490\s*€\s*HT/g, to: "Audit Flash sur mesure" },
  { from: /Audit Flash à partir de 490\s*€\s*HT/g, to: "Audit Flash sur mesure" },
  { from: /audit Flash 490\s*€\s*HT/g, to: "audit Flash sur mesure" },
  // Phrases composées avec prix
  {
    from: /Nos services incluent des audits à partir de 490\s*€\s*HT et des interventions dès 590\s*€\s*HT,?\s*/g,
    to: "",
  },
  { from: /Nos services débutent à 490\s*€\s*HT\.\s*/g, to: "" },
  { from: /\(à partir de 490\s*€\s*HT\)/g, to: "" },
  { from: /\(dès 490\s*€\s*HT\)/g, to: "" },
  // Mention isolée du prix
  { from: /,?\s*à partir de 490\s*€\s*HT/g, to: "" },
  { from: /,?\s*dès 490\s*€\s*HT/g, to: "" },
  { from: /,?\s*selon 490\s*€\s*HT/g, to: "" },
];

/**
 * Applique les remplacements UNIQUEMENT dans les champs pitch/directAnswer/ecosystem.
 * Préserve les mentions légitimes dans servicesContext et FAQ.
 */
function fixContent(content: string): { newContent: string; changes: number } {
  let changes = 0;
  let newContent = content;

  // Extract les champs à modifier
  const targets = [
    "pitchFr",
    "pitchEn",
    "directAnswerFr",
    "directAnswerEn",
    "ecosystemFr",
    "ecosystemEn",
  ];

  for (const field of targets) {
    const pattern = new RegExp(`(${field}:\\s*\\n?\\s*")([^"]+)(")`, "g");
    newContent = newContent.replace(pattern, (match, prefix, body, suffix) => {
      let newBody = body;
      for (const r of REPLACEMENTS) {
        const before = newBody;
        newBody = newBody.replace(r.from, r.to);
        if (before !== newBody) changes++;
      }
      // Cleanup spaces multiples + ponctuation orpheline
      newBody = newBody.replace(/\s+/g, " ");
      newBody = newBody.replace(/\s+,/g, ",");
      newBody = newBody.replace(/\s+\./g, ".");
      newBody = newBody.replace(/,\s*\./g, ".");
      newBody = newBody.replace(/\.\s*\./g, ".");
      newBody = newBody.replace(/\.\s+$/g, ".");
      newBody = newBody.trim();
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

  console.log(`[auto-fix-prices] Files modified: ${filesModified}/${files.length}`);
  console.log(`[auto-fix-prices] Total replacements: ${totalChanges}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
