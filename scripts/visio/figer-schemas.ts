#!/usr/bin/env tsx
/**
 * FIGE le JSON Schema de chaque schéma envoyé à OpenAI (ADR 0055).
 *
 * `pnpm exec tsx scripts/visio/figer-schemas.ts` écrit
 * `src/server/visio/schemas/<nom>.schema.json` pour chaque entrée de
 * `SCHEMAS_VISIO`. Le test `le-schema-envoye-est-fige.spec.ts` compare ces
 * fichiers à ce que `zodTextFormat` produit : une modification du Zod sans
 * passage par ce script rougit, et le diff des `.schema.json` se lit en revue.
 *
 * N'appelle AUCUN réseau : `zodTextFormat` est une fonction pure du SDK.
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import { formatDeSortie } from "../../src/server/visio/openai/client";
import { SCHEMAS_VISIO } from "../../src/server/visio/schemas";

const DOSSIER = path.resolve(process.cwd(), "src/server/visio/schemas");

for (const s of Object.values(SCHEMAS_VISIO)) {
  const format = formatDeSortie(s.schema, s.nom);
  writeFileSync(path.join(DOSSIER, s.fichier), JSON.stringify(format.schema, null, 2) + "\n");
  console.log(`figé : ${s.fichier}`);
}
