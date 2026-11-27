// @vitest-environment node

/**
 * Autofacture d'APPORTEUR : en franchise 293 B, la pièce ne montre ni « TVA (0 %) » ni « Total TTC »
 * (il n'y a pas de TVA, donc pas de TTC). Le gabarit est PARTAGÉ avec les formateurs : sans
 * `presentation: "apporteur"`, le rendu reste celui d'avant (garde de non-régression).
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { AutofactureHonorairesPdf, type AutofactureData } from "../autofacture-honoraires";

const base: AutofactureData = {
  numero: "AXI-APP-2026-0001",
  dateEmission: "3 novembre 2026",
  dateEcheance: "3 décembre 2026",
  contestationAvant: "3 décembre 2026",
  periodeLabel: "commissions exigibles au 3 novembre 2026",
  sousTraitant: {
    nom: "Camille Martin",
    siret: "12345678900012",
    numeroTvaIntracom: null,
    adresseProfessionnelle: "1 rue de Paris, 75001 Paris",
    email: null,
  },
  identite: { raisonSociale: "Axion IA" } as AutofactureData["identite"],
  lignes: [{ designation: "Commission d'apport", montantHtCents: 50_000 }],
  regimeHonoraires: "franchise_293b",
};

const rendu = (d: Partial<AutofactureData>) =>
  collectPdfTextNormalized(
    React.createElement(AutofactureHonorairesPdf, { data: { ...base, ...d } }),
  );

describe("autofacture d'apporteur en franchise 293 B", () => {
  it("ni « TVA (0 % » ni « TTC » : « Total à payer » et la mention 293 B", () => {
    const t = rendu({ presentation: "apporteur" });
    expect(t).not.toMatch(/TVA \(0/);
    expect(t).not.toMatch(/TTC/);
    expect(t).toContain("Total à payer");
    expect(t).toContain("293 B");
  });

  it("avoir en franchise : « Total de l'avoir », ni TVA ni TTC", () => {
    const t = rendu({
      presentation: "apporteur",
      avoir: {
        factureInitiale: "AXI-APP-2026-0000",
        dateFactureInitiale: null,
        imputation: "déduit du virement de l'autofacture AXI-APP-2026-0001",
      },
    });
    expect(t).not.toMatch(/TVA \(0/);
    expect(t).not.toMatch(/TTC/);
    expect(t).toContain("Total de l'avoir");
  });

  it("assujetti : « TVA (20 %) » et « Total TTC » inchangés", () => {
    const t = rendu({
      presentation: "apporteur",
      regimeHonoraires: "assujetti_20",
      sousTraitant: { ...base.sousTraitant, numeroTvaIntracom: "FR12345678901" },
    });
    expect(t).toContain("TVA (20 %)");
    expect(t).toContain("Total TTC");
  });

  it("l'apporteur conserve la qualité de fournisseur (et non « le sous-traitant »)", () => {
    const t = rendu({ presentation: "apporteur" });
    expect(t).toContain("L'apporteur conserve la qualité de fournisseur");
    expect(t).not.toContain("Le sous-traitant conserve");
  });

  it("GARDE formateurs : sans `presentation`, rendu inchangé (TVA (0 %) et Total TTC encore là)", () => {
    const t = rendu({});
    expect(t).toMatch(/TVA \(0/);
    expect(t).toContain("Total TTC");
    expect(t).toContain("Le sous-traitant conserve la qualité de fournisseur");
  });
});
