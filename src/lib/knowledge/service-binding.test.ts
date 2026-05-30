import { describe, it, expect } from "vitest";
import { getServiceOffer, getServiceCta, buildServiceOfferJsonLd } from "./service-binding";

describe("service-binding (KB V4.1 B+C — code-only)", () => {
  it("dérive un prix d'entrée pour les services avec tiers (pricing.ts SSOT)", () => {
    for (const slug of [
      "audit",
      "implementation",
      "interventions-formations",
      "un-a-un",
    ] as const) {
      const offer = getServiceOffer(slug);
      expect(offer).not.toBeNull();
      expect(offer!.fromPriceEur).toBeTypeOf("number");
      expect(offer!.fromPriceEur!).toBeGreaterThan(0);
      expect(offer!.fromPriceLabel).toMatch(/€/);
      expect(offer!.pageHref).toMatch(/^\//);
    }
  });

  it("n'expose PAS de prix pour sites-web-augmentes (pas de tiers dédiés)", () => {
    const offer = getServiceOffer("sites-web-augmentes");
    expect(offer).not.toBeNull();
    expect(offer!.fromPriceEur).toBeNull();
    expect(offer!.fromPriceLabel).toBeNull();
  });

  it("émet un Offer JSON-LD UNIQUEMENT si un tarif existe", () => {
    const auditOffer = buildServiceOfferJsonLd("audit");
    expect(auditOffer).not.toBeNull();
    expect(auditOffer!["@type"]).toBe("Offer");
    expect(auditOffer!.priceCurrency).toBe("EUR");
    expect(auditOffer!.price).toBeTypeOf("number");

    // sites-web : pas de tarif → pas d'Offer (décision Will « Offer si tarif »).
    expect(buildServiceOfferJsonLd("sites-web-augmentes")).toBeNull();
  });

  it("fournit un CTA contextuel vers la page service", () => {
    const cta = getServiceCta("audit");
    expect(cta).not.toBeNull();
    expect(cta!.href).toBe("/audit");
    expect(cta!.labelFr).toContain("Découvrir");
    expect(cta!.fromLabelFr).toMatch(/dès/);

    const sw = getServiceCta("sites-web-augmentes");
    expect(sw).not.toBeNull();
    expect(sw!.fromLabelFr).toBeNull(); // pas de sous-texte prix
  });
});
