#!/usr/bin/env tsx
/**
 * Régénère _auto-generated-index.ts en scannant TOUS les fichiers TS dans copy/
 * (sauf les fichiers manuels qui sont déjà dans index.ts manuel MANUAL_COPIES_BY_SLUG).
 *
 * Utile après ajout manuel de fichiers TS (hors pipeline DB → TS).
 */
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const COPY_DIR = resolve(process.cwd(), "src/content/villes/copy");
const AUTO_INDEX_PATH = resolve(COPY_DIR, "_auto-generated-index.ts");
const VILLES_INDEX_PATH = resolve(process.cwd(), "src/content/villes/index.ts");

// Lire index.ts pour récupérer les villes déjà importées manuellement
const indexContent = readFileSync(VILLES_INDEX_PATH, "utf-8");
const manualImportRe = /import\s+\{\s+(\w+_COPY)\s+\}\s+from\s+"\.\/copy\/([\w-]+)"/g;
const manualSlugs = new Set<string>();
let m: RegExpExecArray | null;
while ((m = manualImportRe.exec(indexContent)) !== null) {
  manualSlugs.add(m[2]!);
}
console.log(`[regen-index] ${manualSlugs.size} slugs manuels détectés dans index.ts`);

// Scanner tous les fichiers TS de copy/
const allFiles = readdirSync(COPY_DIR).filter(
  (f) =>
    f.endsWith(".ts") && !f.startsWith("_") && f !== "types.ts" && f !== "resolve-with-copy.ts",
);

const autoSlugs: string[] = [];
for (const file of allFiles) {
  const slug = file.replace(/\.ts$/, "");
  if (manualSlugs.has(slug)) continue;
  autoSlugs.push(slug);
}
autoSlugs.sort();
console.log(`[regen-index] ${autoSlugs.length} slugs auto (incluant manuels ajoutés récemment)`);

function slugToConstantName(slug: string): string {
  return slug.replaceAll("-", "_").toUpperCase() + "_COPY";
}

const importLines = autoSlugs
  .map((slug) => `import { ${slugToConstantName(slug)} } from "./${slug}";`)
  .join("\n");
const mapLines = autoSlugs.map((slug) => `  "${slug}": ${slugToConstantName(slug)},`).join("\n");

const content = `// AUTO-GENERATED 2026-05-27 — Index des copies villes T3 LLM-generated + Claude Code manuels.
// Consommé par src/content/villes/index.ts (merge avec MANUAL_COPIES_BY_SLUG).
// Re-généré par scripts/regen-auto-index-from-fs.ts (scan fs) ou scripts/export-villecopy-db-to-ts.ts (DB).

import type { VilleCopy } from "./types";

${importLines}

export const AUTO_GENERATED_COPIES_BY_SLUG: Readonly<Record<string, VilleCopy>> = {
${mapLines}
};
`;

writeFileSync(AUTO_INDEX_PATH, content, "utf-8");
console.log(`[regen-index] Wrote ${AUTO_INDEX_PATH} with ${autoSlugs.length} entries`);
