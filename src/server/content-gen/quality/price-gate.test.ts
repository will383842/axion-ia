// Tests du price-gate SSOT (Sprint Pricing SSOT 2026-05-29, Phase 3).
import { describe, it, expect } from "vitest";
import { AUDIT_TIERS, INTERVENTION_TIERS, getTierById } from "@/content/pricing";
import { findNonSsotPrices, passesPriceGate } from "./price-gate";

const flash = getTierById(AUDIT_TIERS, "audit-flash").priceFlat!; // 490
const dirigeants = getTierById(INTERVENTION_TIERS, "intervention-dirigeants").priceFlat!; // 990

describe("price-gate — findNonSsotPrices", () => {
  it("laisse passer un montant SSOT", () => {
    expect(findNonSsotPrices(`Audit Flash ${flash} € HT`)).toEqual([]);
    expect(findNonSsotPrices(`Coaching ${dirigeants} € HT`)).toEqual([]);
  });

  it("laisse passer les tokens {{price:…}} (aucun € littéral)", () => {
    expect(findNonSsotPrices("Audit Flash {{price:audit-flash|flat}} pour démarrer")).toEqual([]);
  });

  it("bloque un montant € absent de la SSOT", () => {
    const v = findNonSsotPrices("Programme coaching 3 500 € HT par mois");
    expect(v).toHaveLength(1);
    expect(v[0]!.value).toBe(3500);
  });

  it("bloque plusieurs montants non-SSOT", () => {
    const v = findNonSsotPrices("de 8 000 € à 80 000 € selon le périmètre");
    expect(v.map((x) => x.value).sort((a, b) => a - b)).toEqual([8000, 80000]);
  });

  it("ignore les montants en $ / USD", () => {
    expect(findNonSsotPrices("budget de 5 000 $ ou 10000 USD")).toEqual([]);
  });

  it("passesPriceGate : vrai si tout est SSOT/token, faux sinon", () => {
    expect(
      passesPriceGate(`Audit dès ${flash} € HT, coaching {{price:intervention-dirigeants}}`),
    ).toBe(true);
    expect(passesPriceGate("offre spéciale 1 234 € HT")).toBe(false);
  });
});
