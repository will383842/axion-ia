#!/usr/bin/env tsx
/**
 * Export DB GeneratedVilleCopy approved → fichiers TS copy/<slug>.ts
 *
 * Promotion explicite : DB row approved → fichier TS gold standard.
 * Le hub ville priorise les fichiers TS (cf. resolveVilleWithCopy.ts:117),
 * donc cette conversion fait passer les villes du tier "DB approved" au tier
 * "TS file" — même rendu, mais inclus dans le sitemap (getIndexableVilles
 * filtre sur ville.copy depuis le fichier TS).
 *
 * Aussi génère src/content/villes/copy/_auto-generated-index.ts qui exporte
 * un map AUTO_GENERATED_COPIES consommé par index.ts (merge avec MANUAL_COPIES).
 *
 * Skip villes ayant déjà un fichier TS manuel (priorité manuel sur auto).
 *
 * Usage : DATABASE_URL='...' DIRECT_URL='...' pnpm tsx scripts/export-villecopy-db-to-ts.ts
 */

import { PrismaClient } from "../prisma/generated/client";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const COPY_DIR = resolve(process.cwd(), "src/content/villes/copy");
const AUTO_INDEX_PATH = resolve(COPY_DIR, "_auto-generated-index.ts");

/**
 * Slug ville → identifier TS export constant (kebab-case → SCREAMING_SNAKE_CASE).
 * "champigny-sur-marne" → "CHAMPIGNY_SUR_MARNE_COPY"
 */
function slugToConstantName(slug: string): string {
  return slug.replaceAll("-", "_").toUpperCase() + "_COPY";
}

/**
 * Slug → file basename (preserve kebab, drop .ts).
 * "champigny-sur-marne" → "champigny-sur-marne"
 */
function slugToFileBasename(slug: string): string {
  return slug;
}

/**
 * Escape string for safe TS template literal.
 * Use JSON.stringify which handles quotes, newlines, unicode.
 */
function jsonString(s: string | null | undefined): string {
  return JSON.stringify(s ?? "");
}

interface DbRow {
  villeSlug: string;
  qualityScore: number | null;
  modelUsed: string | null;
  pitchFr: string;
  directAnswerFr: string;
  ecosystemFr: string;
  distancesFr: string;
  topSectorsNaf: string[];
  servicesContextJson: unknown;
  faqGeolocaliseeJson: unknown;
}

interface ServiceCtxRow {
  audit?: { fr: string };
  interventions?: { fr: string };
  implementation?: { fr: string };
  unAUn?: { fr: string };
  sitesWeb?: { fr: string };
}

interface FaqRow {
  q: string;
  a: string;
}

function generateTsFileContent(row: DbRow): string {
  const constantName = slugToConstantName(row.villeSlug);
  const services = (row.servicesContextJson ?? {}) as ServiceCtxRow;
  const faqArr = (row.faqGeolocaliseeJson ?? []) as ReadonlyArray<FaqRow>;

  // Mirror FR → EN (Will rule : NE JAMAIS générer/traduire EN — copy fr pour en)
  const audit = services.audit?.fr ?? "";
  const interventions = services.interventions?.fr ?? "";
  const implementation = services.implementation?.fr ?? "";
  const unAUn = services.unAUn?.fr ?? "";
  const sitesWeb = services.sitesWeb?.fr ?? "";

  // Construire servicesContext seulement avec les champs présents
  const svcLines: string[] = [];
  if (audit) svcLines.push(`    audit: { fr: ${jsonString(audit)}, en: ${jsonString(audit)} },`);
  if (interventions)
    svcLines.push(
      `    interventions: { fr: ${jsonString(interventions)}, en: ${jsonString(interventions)} },`,
    );
  if (implementation)
    svcLines.push(
      `    implementation: { fr: ${jsonString(implementation)}, en: ${jsonString(implementation)} },`,
    );
  if (unAUn) svcLines.push(`    unAUn: { fr: ${jsonString(unAUn)}, en: ${jsonString(unAUn)} },`);
  if (sitesWeb)
    svcLines.push(`    sitesWeb: { fr: ${jsonString(sitesWeb)}, en: ${jsonString(sitesWeb)} },`);

  const faqLines = faqArr
    .map((q) => `    { q: ${jsonString(q.q)}, a: ${jsonString(q.a)} },`)
    .join("\n");

  const topSectors = (row.topSectorsNaf ?? []).map((s) => `    ${jsonString(s)},`).join("\n");

  return `// AUTO-GENERATED 2026-05-27 from GeneratedVilleCopy (T3 batch).
// Quality score: ${row.qualityScore ?? "n/a"} — Model: ${row.modelUsed ?? "n/a"}.
// DO NOT EDIT manually — re-export via scripts/export-villecopy-db-to-ts.ts.
// EN = mirror FR (Will rule 2026-05-22 : NE JAMAIS traduire EN pour villes).

import type { VilleCopy } from "./types";

export const ${constantName}: VilleCopy = {
  pitchFr: ${jsonString(row.pitchFr)},
  pitchEn: ${jsonString(row.pitchFr)},
  directAnswerFr: ${jsonString(row.directAnswerFr)},
  directAnswerEn: ${jsonString(row.directAnswerFr)},
  ecosystemFr: ${jsonString(row.ecosystemFr)},
  ecosystemEn: ${jsonString(row.ecosystemFr)},
  distancesFr: ${jsonString(row.distancesFr)},
  distancesEn: ${jsonString(row.distancesFr)},
  topSectorsNaf: [
${topSectors}
  ],
  servicesContext: {
${svcLines.join("\n")}
  },
  faqGeolocalisee: [
${faqLines}
  ],
};
`;
}

function generateAutoIndexContent(slugs: ReadonlyArray<string>): string {
  const importLines = slugs
    .map((slug) => `import { ${slugToConstantName(slug)} } from "./${slugToFileBasename(slug)}";`)
    .join("\n");
  const mapLines = slugs.map((slug) => `  "${slug}": ${slugToConstantName(slug)},`).join("\n");

  return `// AUTO-GENERATED 2026-05-27 — Index des copies villes T3 LLM-generated.
// Consommé par src/content/villes/index.ts (merge avec MANUAL_COPIES_BY_SLUG).
// Re-généré par scripts/export-villecopy-db-to-ts.ts.

import type { VilleCopy } from "./types";

${importLines}

export const AUTO_GENERATED_COPIES_BY_SLUG: Readonly<Record<string, VilleCopy>> = {
${mapLines}
};
`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.generatedVilleCopy.findMany({
      where: { status: "approved" },
      select: {
        villeSlug: true,
        qualityScore: true,
        modelUsed: true,
        pitchFr: true,
        directAnswerFr: true,
        ecosystemFr: true,
        distancesFr: true,
        topSectorsNaf: true,
        servicesContextJson: true,
        faqGeolocaliseeJson: true,
      },
    });

    console.log(`[export] ${rows.length} rows approved en DB`);

    if (!existsSync(COPY_DIR)) {
      mkdirSync(COPY_DIR, { recursive: true });
    }

    const writtenSlugs: string[] = [];
    let skippedExisting = 0;

    for (const row of rows) {
      const filePath = resolve(COPY_DIR, `${slugToFileBasename(row.villeSlug)}.ts`);

      // Skip si fichier TS existe DÉJÀ (priorité manuel)
      if (existsSync(filePath)) {
        skippedExisting++;
        continue;
      }

      const content = generateTsFileContent(row as DbRow);
      writeFileSync(filePath, content, "utf-8");
      writtenSlugs.push(row.villeSlug);
    }

    console.log(
      `[export] Wrote ${writtenSlugs.length} new TS files, skipped ${skippedExisting} existing.`,
    );

    // Auto-generated index
    writtenSlugs.sort();
    const indexContent = generateAutoIndexContent(writtenSlugs);
    writeFileSync(AUTO_INDEX_PATH, indexContent, "utf-8");
    console.log(`[export] Wrote ${AUTO_INDEX_PATH} (${writtenSlugs.length} entries)`);

    console.log("");
    console.log("=== NEXT STEPS ===");
    console.log("1. Patch src/content/villes/index.ts pour merger AUTO_GENERATED_COPIES_BY_SLUG");
    console.log("2. pnpm typecheck");
    console.log("3. git add src/content/villes/copy/*.ts src/content/villes/index.ts");
    console.log("4. git commit + push");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[export] error:", err);
  process.exit(1);
});
