/**
 * Validation JSON-LD (refonte 2026-06-22) — n'est PLUS un stub.
 *
 * Délègue à la spec vitest `src/lib/__tests__/jsonld-validation.spec.ts` qui
 * exerce les factories JSON-LD (Article/BlogPosting/NewsArticle/HowTo/QAPage/
 * FAQPage/Person…) et valide la structure : présence @context/@type, aucune
 * interpolation cassée (`undefined`, `${`), @id/url bien formés.
 *
 * `pnpm schemacheck` exécute donc une VRAIE validation (gate CI).
 */

import { execSync } from "node:child_process";

const SPEC = "src/lib/__tests__/jsonld-validation.spec.ts";

try {
  execSync(`npx vitest run ${SPEC}`, { stdio: "inherit" });
  console.log("[schemacheck] OK — schemas JSON-LD validés (structure + interpolation).");
} catch {
  console.error("[schemacheck] FAIL — un schema JSON-LD est invalide (voir ci-dessus).");
  process.exit(1);
}
