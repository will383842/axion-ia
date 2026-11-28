import { describe, expect, it } from "vitest";

import { journeeCompte, jourParisDe } from "../challenge-regles";

// Lot I (#2464) : quelle Journée compte pour le challenge de décembre. Valeurs fictives.
const P = { debutLe: "2026-12-01", finLe: "2026-12-31" };
const base = {
  ...P,
  jourFacture: "2026-12-10",
  payeeIntegralementLe: "2026-12-20" as string | null,
  paiementJusquAu: null as string | null,
  netHtCents: 150_000,
};

describe("journeeCompte : la date de facture, le paiement en entier, un net positif", () => {
  it("facture du 1er décembre à 0 h 30 heure de Paris → compte", () => {
    const jour = jourParisDe(new Date("2026-11-30T23:30:00Z")); // 00:30 à Paris
    expect(jour).toBe("2026-12-01");
    expect(journeeCompte({ ...base, jourFacture: jour })).toBe(true);
  });
  it("31 décembre 23:59:59 (Paris) → compte", () => {
    const jour = jourParisDe(new Date("2026-12-31T22:59:59Z"));
    expect(jour).toBe("2026-12-31");
    expect(journeeCompte({ ...base, jourFacture: jour })).toBe(true);
  });
  it("1er janvier 0 h (Paris) → non", () => {
    const jour = jourParisDe(new Date("2026-12-31T23:00:00Z"));
    expect(jour).toBe("2027-01-01");
    expect(journeeCompte({ ...base, jourFacture: jour })).toBe(false);
  });
  it("avant le début → non", () => {
    expect(journeeCompte({ ...base, jourFacture: "2026-11-30" })).toBe(false);
  });
  it("acompte en décembre, solde payé en janvier : compte si payé en entier à temps", () => {
    expect(
      journeeCompte({
        ...base,
        jourFacture: "2026-12-05",
        payeeIntegralementLe: "2027-01-20",
        paiementJusquAu: "2027-03-31",
      }),
    ).toBe(true);
  });
  it("payée en entier après paiementJusquAu → non", () => {
    expect(
      journeeCompte({ ...base, payeeIntegralementLe: "2027-04-01", paiementJusquAu: "2027-03-31" }),
    ).toBe(false);
  });
  it("jamais payée en entier → non", () => {
    expect(journeeCompte({ ...base, payeeIntegralementLe: null })).toBe(false);
  });
  it("prix réduit : net > 0 → compte (pour 1)", () => {
    expect(journeeCompte({ ...base, netHtCents: 30_000 })).toBe(true);
  });
  it("offerte (net 0) → non", () => {
    expect(journeeCompte({ ...base, netHtCents: 0 })).toBe(false);
  });
  it("avoir total (net négatif ou nul) → non", () => {
    expect(journeeCompte({ ...base, netHtCents: -10_000 })).toBe(false);
  });
});
