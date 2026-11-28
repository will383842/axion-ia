/**
 * Verrou du constat du point 17 (#2464) : l'annexe 1 du contrat 2.6 (grille v2) ne contient aucune
 * Journée IA. Si on « corrige » un jour la v2 vers 500 €, ce test rougit.
 * Fixture figée : annexe 1 de la 2.6, extraite de l'historique du dépôt (A1.1 à A1.7).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GRILLE_DE_LA_VERSION } from "../regles";

const annexe = readFileSync(join(__dirname, "fixtures", "annexe1-contrat-2-6.txt"), "utf8");

describe("annexe 1 du contrat 2.6 : aucune Journée IA", () => {
  it("la fixture est bien l'annexe 1, jusqu'à A1.7 inclus", () => {
    expect(annexe).toContain("## Annexe 1");
    expect(annexe).toContain("### A1.7");
  });
  it("ne contient ni « Journée IA » ni « 1 490 »", () => {
    expect(annexe).not.toMatch(/Journée IA/i);
    expect(annexe).not.toContain("1 490");
  });
  it("A1.5 renvoie à A1.7", () => {
    const a15 = annexe.slice(annexe.indexOf("### A1.5"), annexe.indexOf("### A1.6"));
    expect(a15).toContain("sous réserve de A1.7");
  });
  it("la 2.6 est en grille v2", () => {
    expect(GRILLE_DE_LA_VERSION["2.6"]).toBe("v2");
  });
});
