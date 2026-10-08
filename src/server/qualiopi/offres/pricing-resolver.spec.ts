import { describe, expect, it } from "vitest";
import {
  findPricingTier,
  deriveTarifType,
  resolveOffrePriceLabel,
  verifyOffreCoherence,
} from "./pricing-resolver";

describe("findPricingTier", () => {
  it("trouve un tier intervention réel", () => {
    expect(findPricingTier("formation-generale-1j")?.id).toBe("formation-generale-1j");
    expect(findPricingTier("intervention-dirigeants")?.id).toBe("intervention-dirigeants");
  });
  // 2026-10-08 : une ancienne fiche (formule à prix erroné, supprimée) se résout vers le palier
  // de la matrice qui la remplace — jamais « Tarif indisponible », jamais l'ancien prix.
  it("un ancien tierId de formule erronée se résout vers la matrice", () => {
    expect(findPricingTier("intervention-essentielle")?.id).toBe("formation-generale-1j");
    expect(findPricingTier("intervention-claude")?.id).toBe("formation-generale-1j");
    expect(findPricingTier("intervention-approfondie")?.id).toBe("formation-generale-2j");
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
  it("a_partir_de pour un format à sous-tiers (audit sur place)", () => {
    const tier = findPricingTier("audit-flash")!;
    expect(deriveTarifType(tier)).toBe("a_partir_de");
  });
  it("fixe pour une formation de la matrice (prix par groupe)", () => {
    expect(deriveTarifType(findPricingTier("formation-generale-1j")!)).toBe("fixe");
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
