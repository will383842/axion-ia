/**
 * Correctif L11b-ux — la touche Entrée dans le volet du motif de refus ne peut
 * jamais soumettre « J'accepte » : le motif vit dans un formulaire SÉPARÉ, dont
 * la réponse est « refusee », et le formulaire de l'accord ne porte aucun champ
 * de saisie.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(join(__dirname, "..", "VueMission.tsx"), "utf8");

/** Le texte de chaque `<form …>…</form>` du composant. */
function formulaires(): string[] {
  return [...SOURCE.matchAll(/<form\b[\s\S]*?<\/form>/g)]
    .map((m) => m[0])
    .filter((f) => f.includes("repondreDepuisFormulaireAction"));
}

describe("page de mission : accord et refus dans deux formulaires", () => {
  it("le formulaire de l'accord ne contient ni motif ni choix de motif", () => {
    const accord = formulaires().filter((f) => f.includes('value="acceptee"'));
    expect(accord).toHaveLength(1);
    expect(accord[0]).not.toMatch(/name="(motif|choix)"/);
    expect(accord[0]).not.toContain('value="refusee"');
  });

  it("le motif vit dans le formulaire du refus, qui répond « refusee »", () => {
    const refus = formulaires().filter((f) => f.includes('name="motif"'));
    expect(refus).toHaveLength(1);
    expect(refus[0]).toContain('name="reponse" value="refusee"');
    expect(refus[0]).not.toContain('value="acceptee"');
  });
});
