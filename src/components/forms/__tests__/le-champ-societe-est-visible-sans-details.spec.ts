import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Décision du fondateur (18/11) : le champ « Société » sort du bloc replié
 * « Ajouter des détails » et suit le champ e-mail. Sans société, la fiche créée
 * depuis la demande sort « particulier » et arrive au CRM sans entreprise.
 * Le champ reste facultatif, même `name`, même envoi.
 */
const source = readFileSync(
  join(process.cwd(), "src", "components", "forms", "UnifiedContactForm.tsx"),
  "utf8",
);

describe("UnifiedContactForm — champ Société", () => {
  const iChamp = source.indexOf('id="unified-companyName"');
  const iBloc = source.indexOf('id="unified-advanced"');
  const iEmail = source.indexOf('id="unified-email"');

  it("est rendu AVANT le bloc replié, juste après l'e-mail", () => {
    expect(iChamp).toBeGreaterThan(-1);
    expect(iBloc).toBeGreaterThan(-1);
    expect(iChamp).toBeGreaterThan(iEmail);
    expect(iChamp).toBeLessThan(iBloc);
    expect(source.indexOf('id="unified-companyName"', iBloc)).toBe(-1);
  });

  it("porte le nouveau libellé FR et EN", () => {
    expect(source).toContain('companyName: "Société (si vous écrivez pour une entreprise)"');
    expect(source).toContain('companyName: "Company (if you are writing on behalf of a business)"');
  });

  it("reste facultatif, relié à son label, avec autocomplete organization", () => {
    expect(source).toContain('htmlFor="unified-companyName"');
    const bloc = source.slice(iChamp, source.indexOf("/>", iChamp));
    expect(bloc).toContain('autoComplete="organization"');
    expect(bloc).toContain('register("companyName")');
    expect(bloc).not.toContain("aria-required");
  });

  it("n'est pas masqué selon la variante (aucune condition autour du champ)", () => {
    const avant = source.slice(Math.max(0, iChamp - 400), iChamp);
    expect(avant).not.toMatch(/&&\s*\(?\s*$/);
    expect(source).not.toContain("hideCompany");
  });
});
