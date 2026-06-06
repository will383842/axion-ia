import { describe, expect, it } from "vitest";
import {
  findPricingTier,
  deriveTarifType,
  resolveOffrePriceLabel,
  verifyOffreCoherence,
} from "./pricing-resolver";

describe("findPricingTier", () => {
  it("trouve un tier intervention réel", () => {
    expect(findPricingTier("intervention-essentielle")?.id).toBe("intervention-essentielle");
    expect(findPricingTier("intervention-dirigeants")?.id).toBe("intervention-dirigeants");
  });
  it("renvoie null pour un tierId inexistant", () => {
    expect(findPricingTier("tier-fantome")).toBeNull();
  });
});

describe("deriveTarifType", () => {
  it("fixe pour un prix unique sans sous-tiers (dirigeants)", () => {
    const tier = findPricingTier("intervention-dirigeants")!;
    expect(deriveTarifType(tier)).toBe("fixe");
  });
  it("a_partir_de pour un format à sous-tiers (essentielle)", () => {
    const tier = findPricingTier("intervention-essentielle")!;
    expect(deriveTarifType(tier)).toBe("a_partir_de");
  });
  it("sur_devis pour un format onQuote (conférence)", () => {
    const tier = findPricingTier("intervention-conference")!;
    expect(deriveTarifType(tier)).toBe("sur_devis");
  });
});

describe("resolveOffrePriceLabel", () => {
  it("rend un libellé prix non vide pour un tier réel", () => {
    expect(resolveOffrePriceLabel("intervention-dirigeants", "fr")).toMatch(/€/);
  });
  it("rend un libellé de repli pour un tier disparu", () => {
    expect(resolveOffrePriceLabel("tier-fantome", "fr")).toBe("Tarif indisponible");
  });
});

describe("verifyOffreCoherence", () => {
  it("ok quand tierId existe et tarifType concorde", () => {
    expect(verifyOffreCoherence({ tierId: "intervention-dirigeants", tarifType: "fixe" }).ok).toBe(
      true,
    );
  });
  it("signale un tierId disparu", () => {
    const r = verifyOffreCoherence({ tierId: "tier-fantome", tarifType: "fixe" });
    expect(r.ok).toBe(false);
    expect(r.ecarts[0]).toContain("introuvable");
  });
  it("signale un tarifType divergent", () => {
    const r = verifyOffreCoherence({ tierId: "intervention-conference", tarifType: "fixe" });
    expect(r.ok).toBe(false);
    expect(r.ecarts[0]).toContain("tarifType");
  });
});
