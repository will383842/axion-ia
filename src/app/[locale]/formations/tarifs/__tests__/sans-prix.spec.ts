/**
 * R5a (A04, décision n°8) — /formations/tarifs reste en ligne (référencement) mais SANS
 * aucun prix de formation : « sur devis ».
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  path.join(process.cwd(), "src/app/[locale]/formations/tarifs/page.tsx"),
  "utf8",
);

describe("/formations/tarifs", () => {
  it("n'importe aucun formateur de montant ni la fourchette de prix du catalogue", () => {
    expect(src).not.toMatch(/formatAmount|getFormationCatalogPriceRange|getFormationV2EntryPrice/);
    expect(src).not.toContain("FORMATION_PRICE_MATRIX");
  });

  it("n'annonce plus de « prix publics » ni de colonne de prix", () => {
    expect(src).not.toMatch(/Prix groupe|Prix publics|prix sont\s+<strong/i);
    expect(src).not.toMatch(/\d[  ]?€/);
  });

  it("dit « sur devis » et envoie vers le rendez-vous gratuit de 45 minutes", () => {
    expect(src).toMatch(/sur devis/i);
    expect(src).toContain("/appel");
    expect(src).toContain("45 minutes");
    expect(src).not.toContain("15 minutes");
  });
});
