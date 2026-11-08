/**
 * R5a — l'offre phare est reliée depuis la navigation. Le bandeau desktop est mesuré pour
 * 7 onglets (Header.budget.spec.ts) : le lien entre par le drawer mobile et le pied de page.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("lien « La Journée IA »", () => {
  it("figure dans le drawer du Header", () => {
    const src = readFileSync("src/components/nav/Header.tsx", "utf8");
    expect(src).toContain('href: "/journee-ia"');
    expect(src).toContain("La Journée IA");
  });

  it("figure dans le pied de page", () => {
    const src = readFileSync("src/components/nav/Footer.tsx", "utf8");
    expect(src).toContain('href: "/journee-ia"');
    expect(src).toContain("La Journée IA");
  });
});
