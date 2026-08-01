#!/usr/bin/env tsx
// Génère `src/generated/indexable-villes.ts` — les slugs des villes RÉELLEMENT
// indexables (= le cap `RANKED_INDEXABLE`, ~480 depuis la décision Will du
// 2026-07-03), consommés par la whitelist Edge `seo-noindex-routes.ts`.
//
// POURQUOI (audit indexation GSC 2026-07-31, P1) :
//   La whitelist Edge portait ~2 157 slugs codés en dur = `getIndexableVilles()`
//   (« a un copy »), une sémantique ANTÉRIEURE au cap. Résultat : les ~1 336
//   villes cappées (copy présent mais hors `RANKED_INDEXABLE`) ne recevaient
//   PAS le `X-Robots-Tag: noindex, follow` — Googlebot devait rendre leur HTML
//   pour découvrir le `<meta>` noindex. En alignant la whitelist sur
//   `isVilleIndexable()` (LA fonction qui pilote le `<meta>` des pages), le
//   header et le meta ne peuvent plus se contredire, et le header couvre enfin
//   toute la surface noindex.
//
//   `isVilleIndexable` est DÉTERMINISTE depuis le 2026-06-14 (plus de drip
//   temporel : `INDEXABLE_RANK.has(slug)`, ensemble figé au build) → un
//   fichier généré ne peut pas dériver pendant la vie d'un déploiement.
//
// FRAÎCHEUR : la version commitée fait foi (Edge-safe, zéro import de data) ;
// le test `seo-noindex-routes.test.ts` compare ce fichier au SSOT — toute
// modification des données villes sans régénération fait échouer Gate A avec
// un message explicite. Régénérer : `pnpm tsx scripts/gen-indexable-villes.ts`.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getIndexableVilles, isVilleIndexable } from "../src/content/villes";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "generated",
  "indexable-villes.ts",
);

const slugs = getIndexableVilles()
  .map((v) => v.slug)
  .filter((slug) => isVilleIndexable(slug))
  .sort();

const body = slugs.map((s) => `  ${JSON.stringify(s)},`).join("\n");

const file = `// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Source : \`scripts/gen-indexable-villes.ts\` (SSOT : \`isVilleIndexable\` /
// \`RANKED_INDEXABLE\` dans \`src/content/villes/index.ts\`).
// Régénérer après toute modification des données villes :
//   pnpm tsx scripts/gen-indexable-villes.ts
// Le test \`seo-noindex-routes.test.ts\` échoue si ce fichier est périmé.
//
// Consommé par la whitelist Edge \`src/lib/seo-noindex-routes.ts\` (X-Robots-Tag).
// Edge-safe : littéral pur, aucun import de data.

export const INDEXABLE_VILLE_SLUGS_CAP: ReadonlyArray<string> = [
${body}
];
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, file, "utf8");
console.log(`[indexable-villes] écrit : ${OUT} (${slugs.length} slugs)`);
