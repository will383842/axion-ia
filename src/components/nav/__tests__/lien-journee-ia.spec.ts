/**
 * L'offre phare est reliée depuis la navigation.
 *
 * Depuis la refonte en-tête/pied du 2026-11-11, « La Journée IA » est un ONGLET de la
 * barre (2ᵉ, juste après « Accueil », en pastille), une ligne du tiroir mobile, et la
 * tête de la colonne « Nos prestations » du pied de page.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lien « La Journée IA »", () => {
  it("figure dans l'en-tête (barre et tiroir)", () => {
    const src = readFileSync("src/components/nav/Header.tsx", "utf8");
    expect(src).toContain('href: "/journee-ia"');
    expect(src).toContain("La Journée IA");
    // Même entrée lue par la barre ET par le tiroir : une seule source.
    expect(src).toMatch(/<NavLink href=\{journeeIa\.href\} label=\{journeeIa\.label\} phare \/>/);
    expect(src).toMatch(/variant="mobile"\s+href=\{journeeIa\.href\}/);
  });

  it("figure dans le pied de page", () => {
    const src = readFileSync("src/components/nav/Footer.tsx", "utf8");
    expect(src).toContain('href: "/journee-ia"');
    expect(src).toContain("La Journée IA");
  });
});
