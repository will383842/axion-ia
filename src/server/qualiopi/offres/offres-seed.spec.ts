import { describe, expect, it } from "vitest";
import { OFFRES_SEED } from "../../../../prisma/seeds/qualiopi/offres";
import { findPricingTier, deriveTarifType } from "./pricing-resolver";

describe("OFFRES_SEED — intégrité du référentiel", () => {
  it("a des tierId uniques", () => {
    const ids = OFFRES_SEED.map((o) => o.tierId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("a des slugs uniques", () => {
    const slugs = OFFRES_SEED.map((o) => o.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("durée min <= max et nb modules min <= max", () => {
    for (const o of OFFRES_SEED) {
      expect(o.dureeHeuresMax).toBeGreaterThanOrEqual(o.dureeHeuresMin);
      expect(o.nbModulesMax).toBeGreaterThanOrEqual(o.nbModulesMin);
      expect(o.modalites.length).toBeGreaterThan(0);
    }
  });

  it("chaque tierId existe dans pricing.ts (pas d'offre orpheline)", () => {
    for (const o of OFFRES_SEED) {
      expect(findPricingTier(o.tierId), `tier manquant: ${o.tierId}`).not.toBeNull();
    }
  });

  it("le tarifType de chaque offre concorde avec pricing.ts", () => {
    for (const o of OFFRES_SEED) {
      const tier = findPricingTier(o.tierId)!;
      expect(deriveTarifType(tier), `tarifType incohérent pour ${o.tierId}`).toBe(o.tarifType);
    }
  });
});
