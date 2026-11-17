import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le formulaire de contact porte civilité (facultative), prénom et nom, avec les
 * bons `autoComplete` : le navigateur remplit chaque champ sans deviner, et le
 * serveur salue « Bonjour Monsieur Dupont, » ou « Bonjour Camille, ».
 */
const source = readFileSync(
  join(process.cwd(), "src", "components", "forms", "UnifiedContactForm.tsx"),
  "utf8",
);

describe("UnifiedContactForm — identité", () => {
  it("déclare les trois autoComplete d'identité", () => {
    expect(source).toContain('autoComplete="honorific-prefix"');
    expect(source).toContain('autoComplete="given-name"');
    expect(source).toContain('autoComplete="family-name"');
  });

  it('n\'a plus de champ « nom complet » (autoComplete="name")', () => {
    expect(source).not.toContain('autoComplete="name"');
    expect(source).not.toContain('register("nom")');
  });

  it("chaque champ a son <label for>, son aria-invalid et son erreur role=alert", () => {
    for (const id of ["unified-civilite", "unified-prenom", "unified-nom-famille"]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
      expect(source).toContain(`id="${id}-err" role="alert"`);
      expect(source).toContain(`"${id}-err"`);
    }
    expect(source).toMatch(/aria-invalid=\{!!errors\.prenom\}/);
    expect(source).toMatch(/aria-invalid=\{!!errors\.nomFamille\}/);
  });

  it("la civilité n'est jamais présélectionnée : première option vide, aucun `selected`", () => {
    const i = source.indexOf('id="unified-civilite"');
    const bloc = source.slice(i, source.indexOf("</select>", i));
    expect(bloc).toContain('<option value="">');
    expect(bloc).not.toMatch(/selected|defaultValue/);
  });

  it("rangée empilée sur mobile, trois colonnes dès `sm`", () => {
    expect(source).toContain("sm:grid-cols-[10rem_1fr_1fr]");
  });

  it("n'envoie plus `nom` : prénom, nom de famille et civilité si présente", () => {
    expect(source).not.toContain('fd.set("nom"');
    expect(source).toContain('fd.set("prenom"');
    expect(source).toContain('fd.set("nomFamille"');
    expect(source).toMatch(/if \(values\.civilite\) fd\.set\("civilite"/);
  });
});
