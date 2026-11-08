/**
 * V5-01 — `JOURNEE_IA_TIER` : constante séparée, 1 490 € HT, hors des tableaux d'offres.
 * Elle ne doit JAMAIS entrer dans AUDIT_TIERS ni INTERVENTION_TIERS (lus par /tarifs,
 * la réservation et les commissions).
 */

import { describe, expect, it } from "vitest";

import { AUDIT_TIERS, INTERVENTION_TIERS, JOURNEE_IA_TIER } from "../pricing";

describe("JOURNEE_IA_TIER", () => {
  it("vaut 1 490 € HT, prix ferme, une journée", () => {
    expect(JOURNEE_IA_TIER.id).toBe("journee-ia");
    expect(JOURNEE_IA_TIER.priceFlat).toBe(1490);
    expect(JOURNEE_IA_TIER.isFromPrice).toBe(false);
    expect(JOURNEE_IA_TIER.durationFr).toBe("1 journée");
    expect(JOURNEE_IA_TIER.audienceSizes).toEqual(["tpe", "pme"]);
  });

  it("ne porte aucune commission", () => {
    expect(JOURNEE_IA_TIER.commissionId).toBeUndefined();
  });

  it("est absente de AUDIT_TIERS et INTERVENTION_TIERS", () => {
    for (const tiers of [AUDIT_TIERS, INTERVENTION_TIERS]) {
      expect(tiers.some((t) => t.id === "journee-ia")).toBe(false);
      expect(tiers).not.toContain(JOURNEE_IA_TIER);
    }
  });
});
