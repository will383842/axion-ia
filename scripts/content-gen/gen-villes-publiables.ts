#!/usr/bin/env tsx
// Génère `src/generated/villes-publiables.ts` (liste Edge-safe des villes qui passent la porte).
//   pnpm tsx scripts/content-gen/gen-villes-publiables.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { rapportVilles } from "../../src/server/content-gen/villes/verdicts-villes";
import { contenuListeGeneree } from "../../src/server/content-gen/villes/liste-generee";

const slugs = rapportVilles()
  .filter((l) => l.publiable)
  .map((l) => l.slug);
writeFileSync(
  join(process.cwd(), "src", "generated", "villes-publiables.ts"),
  contenuListeGeneree(slugs),
);
console.log(`${slugs.length} ville(s) publiable(s) écrite(s).`);
