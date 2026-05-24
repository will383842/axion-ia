// Tests quote-helpers — Sprint X.7.

import { describe, it, expect, vi } from "vitest";
import { requiresQuote, generateQuoteNumber, computeQuotePricing } from "./quote-helpers";

describe("requiresQuote", () => {
  it("true pour conference (Sur devis catalogue)", () => {
    expect(requiresQuote("conference", 0)).toBe(true);
  });

  it("true si basePriceHtCents > 5 000 € HT", () => {
    expect(requiresQuote("essentielle", 600_000)).toBe(true);
  });

  it("false pour essentielle palier standard 890 €", () => {
    expect(requiresQuote("essentielle", 89_000)).toBe(false);
  });

  it("false pour Approfondie palier intimiste 1 190 €", () => {
    expect(requiresQuote("approfondie", 119_000)).toBe(false);
  });

  it("false si basePriceHtCents null/undefined", () => {
    expect(requiresQuote("dirigeants", null)).toBe(false);
    expect(requiresQuote("dirigeants", undefined)).toBe(false);
  });

  it("borne supérieure stricte : 500 000 cents (5 000 €) exact = false", () => {
    expect(requiresQuote("essentielle", 500_000)).toBe(false);
    expect(requiresQuote("essentielle", 500_001)).toBe(true);
  });
});

describe("computeQuotePricing", () => {
  it("calcul TVA FR 20%", () => {
    const r = computeQuotePricing({
      amountHtCents: 100_000,
      vatRate: 20,
      vatReverseCharge: false,
    });
    expect(r.amountHtCents).toBe(100_000);
    expect(r.vatAmountCents).toBe(20_000);
    expect(r.amountTtcCents).toBe(120_000);
    expect(r.vatMention).toBe("TVA 20.00 %");
  });

  it("reverse-charge EE/B2B intra-UE → TVA 0", () => {
    const r = computeQuotePricing({
      amountHtCents: 100_000,
      vatRate: 0,
      vatReverseCharge: true,
    });
    expect(r.vatAmountCents).toBe(0);
    expect(r.amountTtcCents).toBe(100_000);
    expect(r.vatMention).toContain("autoliquidation");
  });

  it("arrondi banker's vs Math.round (basique)", () => {
    // 99 € HT * 20 % = 19.80 → round 1 980
    const r = computeQuotePricing({
      amountHtCents: 9_900,
      vatRate: 20,
      vatReverseCharge: false,
    });
    expect(r.vatAmountCents).toBe(1_980);
    expect(r.amountTtcCents).toBe(11_880);
  });

  it("VAT rate 5.5% (FR taux réduit) — précision décimale", () => {
    const r = computeQuotePricing({
      amountHtCents: 10_000,
      vatRate: 5.5,
      vatReverseCharge: false,
    });
    expect(r.vatAmountCents).toBe(550);
    expect(r.vatMention).toBe("TVA 5.50 %");
  });
});

describe("generateQuoteNumber", () => {
  it("formate DEVIS-YYYY-NNNN avec padding 4", async () => {
    const mockPrisma = {
      quote: { count: vi.fn().mockResolvedValue(7) },
    } as never;
    const n = await generateQuoteNumber(mockPrisma, 2026);
    expect(n).toBe("DEVIS-2026-0008");
  });

  it("padding à 4 chars même au-delà 9999", async () => {
    const mockPrisma = {
      quote: { count: vi.fn().mockResolvedValue(9999) },
    } as never;
    const n = await generateQuoteNumber(mockPrisma, 2026);
    expect(n).toBe("DEVIS-2026-10000"); // padStart laisse passer >4
  });

  it("compteur par année (filtre prefix)", async () => {
    const countSpy = vi.fn().mockResolvedValue(0);
    const mockPrisma = { quote: { count: countSpy } } as never;
    await generateQuoteNumber(mockPrisma, 2027);
    expect(countSpy).toHaveBeenCalledWith({
      where: { number: { startsWith: "DEVIS-2027-" } },
    });
  });
});
