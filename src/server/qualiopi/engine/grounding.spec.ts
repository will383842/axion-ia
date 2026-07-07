/**
 * Tests — grounding.ts : ancrage sur la vraie stack Axion-IA.
 */

import { describe, it, expect } from "vitest";
import { axionIaStackGrounding } from "./grounding";

describe("grounding", () => {
  it("produit un contexte mentionnant la posture et des outils réels", () => {
    const g = axionIaStackGrounding();
    expect(g).toContain("CONTEXTE AXION-IA");
    expect(g).toContain("Stack IA enseignée");
    // Au moins un outil réel du catalogue
    expect(g).toContain("Claude");
  });

  it("n'injecte aucun chiffre parasite (%/€) susceptible d'être halluciné", () => {
    const g = axionIaStackGrounding();
    expect(g).not.toMatch(/\d+\s?%/);
    expect(g).not.toMatch(/[€$]/);
  });
});
