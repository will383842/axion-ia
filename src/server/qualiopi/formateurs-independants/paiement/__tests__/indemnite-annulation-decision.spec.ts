// @vitest-environment node

/**
 * Lot D (M11) — de la mission annulée à l'indemnité : quelles demi-journées sont
 * annulées, quand commence la première, puis LE calcul existant
 * (`indemniteAnnulation`, `totaliser`). Contre-calcul chiffré HT / TVA / TTC.
 */

import { describe, expect, it } from "vitest";

import { instantParis } from "../../argent/dates";
import { apercuIndemniteAnnulation } from "../indemnite-annulation-decision";

const JOURS = [
  { jour: "2026-11-16", heureDebut: "09:00", heureFin: "17:00" },
  { jour: "2026-11-17", heureDebut: "09:00", heureFin: "12:30" },
];
const base = {
  journeesPrevues: JOURS,
  tarifJourneeHtCents: 60_000,
  accepteeAvant: true,
  parAxion: true,
  regimeTva: "assujetti_20" as const,
};

describe("instantParis", () => {
  it("heure de Paris → instant, été comme hiver", () => {
    expect(instantParis("2026-11-16", "09:00").toISOString()).toBe("2026-11-16T08:00:00.000Z");
    expect(instantParis("2026-07-01", "09:00").toISOString()).toBe("2026-07-01T07:00:00.000Z");
  });
});

describe("aperçu de l'indemnité d'annulation", () => {
  it("annulée 48 h avant : 3 demi-journées annulées, 50 % hors forfait ; assujetti", () => {
    const a = apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-14T08:00:00Z") });
    // 3 demi-journées × 600 € / 2 = 900 € HT ; 50 % = 450 € HT.
    expect(a.demiJourneesAnnulees).toBe(3);
    expect(a.indemnite.due).toBe(true);
    expect(a.indemnite.montantHtCents).toBe(45_000);
    // Contre-calcul : TVA 20 % = 90 € ; TTC 540 €.
    expect(a.totaux.totalHtCents).toBe(45_000);
    expect(a.totaux.tvaCents).toBe(9_000);
    expect(a.totaux.totalTtcCents).toBe(54_000);
    expect(a.indemnite.jourAnnulation).toBe("2026-11-14");
    expect(a.indemnite.echeance).toBe("2026-12-14");
  });

  it("franchise en base : aucune TVA, TTC = HT", () => {
    const a = apercuIndemniteAnnulation({
      ...base,
      regimeTva: "franchise_293b",
      annuleeA: new Date("2026-11-14T08:00:00Z"),
    });
    expect([a.totaux.totalHtCents, a.totaux.tvaCents, a.totaux.totalTtcCents]).toEqual([
      45_000, 0, 45_000,
    ]);
  });

  it("annulée en cours de première journée (12 h 30) : seules l'après-midi et le lendemain comptent", () => {
    const a = apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-16T11:30:00Z") });
    expect(a.demiJourneesAnnulees).toBe(2);
    // 2 × 600 / 2 = 600 € ; 50 % = 300 € HT ; TVA 60 € ; TTC 360 €.
    expect(a.totaux.totalHtCents).toBe(30_000);
    expect(a.totaux.totalTtcCents).toBe(36_000);
  });

  it("plus de 72 h avant, désistement du formateur, mission non acceptée : rien n'est dû", () => {
    expect(
      apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-12T08:00:00Z") }).indemnite
        .due,
    ).toBe(false);
    expect(
      apercuIndemniteAnnulation({
        ...base,
        parAxion: false,
        annuleeA: new Date("2026-11-15T08:00:00Z"),
      }).indemnite.due,
    ).toBe(false);
    expect(
      apercuIndemniteAnnulation({
        ...base,
        accepteeAvant: false,
        annuleeA: new Date("2026-11-15T08:00:00Z"),
      }).totaux.totalHtCents,
    ).toBe(0);
  });

  it("annulée après la dernière journée : aucune demi-journée annulée, rien n'est dû", () => {
    const a = apercuIndemniteAnnulation({ ...base, annuleeA: new Date("2026-11-18T08:00:00Z") });
    expect(a.demiJourneesAnnulees).toBe(0);
    expect(a.indemnite.due).toBe(false);
  });
});
