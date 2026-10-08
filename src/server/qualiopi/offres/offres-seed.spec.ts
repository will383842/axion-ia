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

// 2026-10-08 (décision de Will) : les fiches des anciennes formules à prix erronés sont retirées
// du seed. Le serveur rejoue ce seed à CHAQUE démarrage : une fiche restée ici reviendrait en base
// même effacée à la main.
describe("OFFRES_SEED — plus aucune fiche de formule à prix erroné", () => {
  it("ni Essentielle, ni Gagner du temps, ni Approfondie, ni Intervention Claude", () => {
    const anciens = [
      "intervention-essentielle",
      "intervention-temps",
      "intervention-approfondie",
      "intervention-claude",
    ];
    for (const o of OFFRES_SEED) {
      expect(anciens, o.tierId).not.toContain(o.tierId);
      expect(o.titreFr).not.toMatch(/Essentielle|Approfondie|Gagner du temps|Intervention Claude/);
    }
  });

  it("chaque fiche garde son code FIXE (aucun code réattribué, aucun doublon)", () => {
    const codes = OFFRES_SEED.map((o) => o.code);
    expect(new Set(codes).size).toBe(codes.length);
    const parTier = Object.fromEntries(OFFRES_SEED.map((o) => [o.tierId, o.code]));
    expect(parTier["intervention-4h"]).toBe("AXI-OFF-001");
    expect(parTier["intervention-conference"]).toBe("AXI-OFF-005");
    expect(parTier["intervention-sur-demande"]).toBe("AXI-OFF-010");
    for (const retire of ["AXI-OFF-002", "AXI-OFF-003", "AXI-OFF-004", "AXI-OFF-008"])
      expect(codes).not.toContain(retire);
  });
});
