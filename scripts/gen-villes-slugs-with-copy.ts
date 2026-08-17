#!/usr/bin/env tsx
// Génère `src/generated/villes-slugs-with-copy.ts` — les SLUGS des communes qui
// ont un contenu éditorial, sans leur contenu.
//
// POURQUOI (découplage du barrel villes, 2026-08-16) :
//   `src/content/villes/index.ts` importe `copy/_auto-generated-index.ts`, qui
//   fait 2 118 imports statiques pour ~29 Mo de TypeScript. Or la logique
//   d'indexabilité (`isPremiumVille`, `RANKED_INDEXABLE`, `getIndexableVilles`)
//   n'a besoin que de SAVOIR si un copy existe — jamais de le lire. En sortant
//   cette information sous forme de liste de clés, `src/content/villes/core.ts`
//   sert tous les consommateurs structurels pour ~1 s au lieu de ~41 s.
//
//   Mesure à froid du 2026-08-16 : data/ 1 065 ms, economic-data/ 1 250 ms,
//   copy/ + enrichissement 38 793 ms.
//
// FRAÎCHEUR : la version commitée fait foi. Le test
// `src/content/villes/__tests__/slugs-with-copy.sync.test.ts` compare ce fichier
// au vrai `COPY_BY_SLUG` (via le barrel complet) et échoue si l'un des deux a
// bougé sans l'autre. Régénérer :
//   pnpm tsx scripts/gen-villes-slugs-with-copy.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { VILLES } from "../src/content/villes";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "generated",
  "villes-slugs-with-copy.ts",
);

const slugs = VILLES.filter((v) => !!v.copy)
  .map((v) => v.slug)
  .sort((a, b) => a.localeCompare(b));

const header = `// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Source : \`scripts/gen-villes-slugs-with-copy.ts\` (SSOT : \`COPY_BY_SLUG\` dans
// \`src/content/villes/index.ts\`).
// Régénérer après tout ajout/retrait de contenu éditorial ville :
//   pnpm tsx scripts/gen-villes-slugs-with-copy.ts
// Le test \`slugs-with-copy.sync.test.ts\` échoue si ce fichier est périmé.
//
// Consommé par \`src/content/villes/core.ts\`, le point d'entrée structurel qui
// évite les 29 Mo de \`copy/\`. Littéral pur : aucun import.

export const VILLE_SLUGS_WITH_COPY: ReadonlyArray<string> = [
`;

const body = slugs.map((s) => `  ${JSON.stringify(s)},`).join("\n");
const full = `${header}${body}\n];\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, full, "utf8");

console.log(`[gen-villes-slugs-with-copy] ${slugs.length} slugs → ${OUT}`);
