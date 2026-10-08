import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { calculerSoldeNegatif } from "../solde-negatif";

// Art. 12.4 : solde négatif affiché à Williams ; remboursement demandable après douze mois sans
// imputation, plafonné aux commissions versées dans les 24 mois précédant la reprise.
const REPRISE = new Date("2026-01-15T10:00:00Z");

describe("solde négatif (art. 12.4)", () => {
  it("rien quand les reprises ne dépassent pas ce qui reste à facturer", () => {
    expect(
      calculerSoldeNegatif(
        {
          reprisesEnAttente: [{ montantCents: -10_000, creeAt: REPRISE }],
          aFacturerCents: 10_000,
          versees: [],
        },
        new Date("2026-10-08T00:00:00Z"),
      ),
    ).toBeNull();
  });

  it("solde affiché ; demandable après douze mois seulement, dans la limite du plafond", () => {
    const e = {
      reprisesEnAttente: [{ montantCents: -50_000, creeAt: REPRISE }],
      aFacturerCents: 10_000,
      versees: [
        { montantCents: 15_000, verseeAt: new Date("2025-06-01T00:00:00Z") }, // dans les 24 mois
        { montantCents: 99_000, verseeAt: new Date("2023-06-01T00:00:00Z") }, // trop ancien
        { montantCents: 7_000, verseeAt: new Date("2026-03-01T00:00:00Z") }, // après la reprise
      ],
    };
    const avant = calculerSoldeNegatif(e, new Date("2026-10-08T00:00:00Z"))!;
    expect(avant).toMatchObject({
      soldeCents: 40_000,
      remboursementDemandable: false,
      plafondCents: 15_000,
    });
    const apres = calculerSoldeNegatif(e, new Date("2027-01-16T00:00:00Z"))!;
    expect(apres).toMatchObject({ remboursementDemandable: true, demandableCents: 15_000 });
  });
});
