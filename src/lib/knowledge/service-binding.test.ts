import { describe, it, expect } from "vitest";
import { getServiceOffer, getServiceCta, buildServiceOfferJsonLd } from "./service-binding";
import { PRIX_PUBLICS_AFFICHES } from "@/content/pricing";

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
      // R7 : interrupteur des prix publics coupé → aucun libellé chiffré.
      expect(offer!.fromPriceLabel).toBeNull();
      expect(offer!.pageHref).toMatch(/^\//);
    }
  });

  it("n'expose PAS de prix pour sites-web-augmentes (pas de tiers dédiés)", () => {
    const offer = getServiceOffer("sites-web-augmentes");
    expect(offer).not.toBeNull();
    expect(offer!.fromPriceEur).toBeNull();
    expect(offer!.fromPriceLabel).toBeNull();
  });

  it("n'émet aucun Offer JSON-LD chiffré interrupteur des prix publics coupé (R7)", () => {
    expect(PRIX_PUBLICS_AFFICHES).toBe(false);
    expect(buildServiceOfferJsonLd("audit")).toBeNull();

    // sites-web : pas de tarif → pas d'Offer (décision Will « Offer si tarif »).
    expect(buildServiceOfferJsonLd("sites-web-augmentes")).toBeNull();
  });

  it("fournit un CTA contextuel vers la page service", () => {
    const cta = getServiceCta("audit");
    expect(cta).not.toBeNull();
    expect(cta!.href).toBe("/audit");
    expect(cta!.labelFr).toContain("Découvrir");
    expect(cta!.fromLabelFr).toBeNull(); // R7 : plus de « dès X € »

    const sw = getServiceCta("sites-web-augmentes");
    expect(sw).not.toBeNull();
    expect(sw!.fromLabelFr).toBeNull(); // pas de sous-texte prix
  });
});
