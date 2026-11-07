/**
 * Mise en sécurité des scripts de régénération des pages ville (audit blog/RAG
 * du 24/10/2026, problème 5). Les scripts ne sont jamais lancés ici : on lit
 * leur texte.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..", "..", "..", "..");
const lire = (chemin: string): string => readFileSync(join(RACINE, chemin), "utf8");

describe("scripts/regen-villes-stratified.ts", () => {
  const src = lire("scripts/regen-villes-stratified.ts");

  it("refuse de tourner tant que la sauvegarde des sections n'existe pas", () => {
    expect(src).toContain("const SAUVEGARDE_DES_RESULTATS_DISPONIBLE = false;");
  });

  it("refuse AVANT toute connexion et tout appel de générateur", () => {
    const main = src.slice(src.indexOf("async function main()"));
    const refus = main.indexOf("MESSAGE_REFUS_SANS_SAUVEGARDE");
    expect(refus).toBeGreaterThan(-1);
    expect(refus).toBeLessThan(main.indexOf("new PrismaClient()"));
    expect(refus).toBeLessThan(main.indexOf("runGenerator("));
    expect(main).toContain("process.exit(1)");
  });
});

describe("scripts/regen-villes-complete.ts", () => {
  const src = lire("scripts/regen-villes-complete.ts");

  it("n'approuve plus sur simple score : passe par decisionApprobationAuto", () => {
    expect(src).toContain("decisionApprobationAuto(");
    expect(src).not.toContain("if (copyResult.qualityScore >= args.autoApproveThreshold)");
  });
});

describe("src/scripts/test-ville-hub-copy-paris.ts", () => {
  it("passe aussi par decisionApprobationAuto", () => {
    const src = lire("src/scripts/test-ville-hub-copy-paris.ts");
    expect(src).toContain("decisionApprobationAuto(");
    expect(src).not.toContain("if (result.qualityScore >= AUTO_APPROVE_THRESHOLD)");
  });
});
