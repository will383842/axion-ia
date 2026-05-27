#!/usr/bin/env tsx
/**
 * Régénère la whitelist INDEXABLE_VILLE_SLUGS de src/lib/seo-noindex-routes.ts
 * depuis getIndexableVilles() (= toutes les villes avec ville.copy).
 *
 * À lancer après chaque export DB→TS qui ajoute des villes au catalogue.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getIndexableVilles } from "../src/content/villes";

const TARGET = resolve(process.cwd(), "src/lib/seo-noindex-routes.ts");

function buildSlugListLines(slugs: ReadonlyArray<string>): string {
  return slugs.map((s) => `  "${s}",`).join("\n");
}

function main() {
  const indexable = [...getIndexableVilles()].sort((a, b) => a.slug.localeCompare(b.slug));
  console.log(`[regen-whitelist] ${indexable.length} villes indexables détectées`);

  const slugs = indexable.map((v) => v.slug);
  const slugLines = buildSlugListLines(slugs);

  // Villes avec copy.services (pour ALL_SERVICE_VILLE_SLUGS)
  // Pour les villes T3 auto-generated, on n'a pas `services` long-form. Seul
  // Paris + quelques T1/T2 ont services pleins. On garde le pattern : INDEXABLE
  // pour TOUTES les villes indexables (= avec ville.copy), ALL_SERVICE pour
  // celles avec ville.copy.services.
  const withServices = indexable.filter((v) => v.copy?.services).map((v) => v.slug);
  const serviceLines = buildSlugListLines(withServices);

  const current = readFileSync(TARGET, "utf-8");

  // Patch INDEXABLE_VILLE_SLUGS
  const newIndexableBlock = `const INDEXABLE_VILLE_SLUGS: ReadonlySet<string> = new Set([
${slugLines}
]);`;
  const patched1 = current.replace(
    /const INDEXABLE_VILLE_SLUGS: ReadonlySet<string> = new Set\(\[[^\]]*\]\);/,
    newIndexableBlock,
  );

  // Patch ALL_SERVICE_VILLE_SLUGS
  const newServiceBlock = `const ALL_SERVICE_VILLE_SLUGS: ReadonlyArray<string> = [
${serviceLines}
];`;
  const patched2 = patched1.replace(
    /const ALL_SERVICE_VILLE_SLUGS: ReadonlyArray<string> = \[[^\]]*\];/,
    newServiceBlock,
  );

  if (patched2 === current) {
    console.log("[regen-whitelist] No changes needed.");
    return;
  }

  writeFileSync(TARGET, patched2, "utf-8");
  console.log(
    `[regen-whitelist] Updated ${TARGET}: ${slugs.length} indexable, ${withServices.length} with services`,
  );
}

main();
