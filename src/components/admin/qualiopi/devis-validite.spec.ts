import { describe, expect, it } from "vitest";
import { formatDateParis, validiteBrouillonModifiable } from "./devis-validite";

describe("formatDateParis", () => {
  it("affiche le jour de Paris, pas la veille UTC (23:30 UTC = 00:30 le lendemain à Paris)", () => {
    expect(formatDateParis(new Date("2026-11-17T23:30:00Z"))).toBe("18/11/2026");
  });
  it("tient aussi en heure d'été", () => {
    expect(formatDateParis(new Date("2026-07-14T22:30:00Z"))).toBe("15/07/2026");
  });
});

describe("validiteBrouillonModifiable", () => {
  const base = {
    statut: "brouillon",
    offreSha256: null,
    financementSuggere: null,
    montantOpcoEstimeCents: null,
  };
  it("autorise un brouillon classique sans estimation", () => {
    expect(validiteBrouillonModifiable(base)).toBe(true);
  });
  it("masque un ancien classique OPCO avec estimation", () => {
    expect(
      validiteBrouillonModifiable({
        ...base,
        financementSuggere: "opco",
        montantOpcoEstimeCents: 120000,
      }),
    ).toBe(false);
  });
  it("autorise un OPCO classique sans montant estimé", () => {
    expect(validiteBrouillonModifiable({ ...base, financementSuggere: "opco" })).toBe(true);
  });
  it("autorise un devis à formules, même avec estimation", () => {
    expect(
      validiteBrouillonModifiable({
        ...base,
        offreSha256: "abc",
        financementSuggere: "opco",
        montantOpcoEstimeCents: 1,
      }),
    ).toBe(true);
  });
  it("masque hors brouillon", () => {
    expect(validiteBrouillonModifiable({ ...base, statut: "envoye" })).toBe(false);
  });
});
