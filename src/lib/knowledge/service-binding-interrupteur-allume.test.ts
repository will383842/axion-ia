// R7 — contre-épreuve de `service-binding.test.ts` : interrupteur des prix publics
// ALLUMÉ, l'Offer chiffrée et le « dès X € » reviennent tels qu'avant. Fichier séparé
// parce que `vi.mock` vaut pour tout le fichier.

import { describe, it, expect, vi } from "vitest";

vi.mock("@/content/pricing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/content/pricing")>()),
  PRIX_PUBLICS_AFFICHES: true,
}));

import { buildServiceOfferJsonLd, getServiceCta, getServiceOffer } from "./service-binding";

describe("service-binding — interrupteur des prix publics allumé (R7)", () => {
  it("réémet l'Offer JSON-LD avec son prix", () => {
    const offre = buildServiceOfferJsonLd("audit");
    expect(offre).not.toBeNull();
    expect(offre!["@type"]).toBe("Offer");
    expect(offre!.priceCurrency).toBe("EUR");
    expect(offre!.price).toBe(getServiceOffer("audit")!.fromPriceEur);
    expect(offre!.price).toBeTypeOf("number");
  });

  it("rend de nouveau le libellé chiffré du CTA", () => {
    expect(getServiceOffer("audit")!.fromPriceLabel).toMatch(/€/);
    expect(getServiceCta("audit")!.fromLabelFr).toMatch(/^dès /);
  });
});
