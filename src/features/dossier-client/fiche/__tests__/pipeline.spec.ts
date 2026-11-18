import { describe, expect, it } from "vitest";

import { calculerPipeline } from "../pipeline";

describe("calculerPipeline", () => {
  it("exclut les prestations terminées et perdues", () => {
    const r = calculerPipeline([
      { etape: "besoin", montantCents: 100_000, probabilitePct: 50 },
      { etape: "terminee", montantCents: 900_000, probabilitePct: 100 },
      { etape: "perdue", montantCents: 800_000, probabilitePct: 0 },
    ]);
    expect(r).toEqual({ nb: 1, htCents: 100_000, chancesPct: 50 });
  });
  it("pondère les chances par le montant", () => {
    const r = calculerPipeline([
      { etape: "besoin", montantCents: 100_000, probabilitePct: 100 },
      { etape: "devis_envoye", montantCents: 300_000, probabilitePct: 20 },
    ]);
    expect(r.chancesPct).toBe(40);
    expect(r.htCents).toBe(400_000);
  });
  it("toutes les chances NULL : non estimées", () => {
    const r = calculerPipeline([{ etape: "besoin", montantCents: 5_000, probabilitePct: null }]);
    expect(r.chancesPct).toBeNull();
    expect(r.htCents).toBe(5_000);
  });
  it("un montant NULL compte pour 0", () => {
    expect(calculerPipeline([{ etape: "besoin", montantCents: null, probabilitePct: 80 }])).toEqual(
      {
        nb: 1,
        htCents: 0,
        chancesPct: null,
      },
    );
  });
});
