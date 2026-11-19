/**
 * R5a (audit d'harmonie 08/11/2026, A03 / décision n°7) — les audits et le 1-to-1 ne
 * s'affichent plus avec un montant : « Sur devis ». L'offre phare est la Journée IA.
 *
 * Les montants restent dans pricing.ts (devis, réservation, barème apporteurs) : seul
 * l'AFFICHAGE public change, via le drapeau `prixPublicMasque` lu par les formateurs.
 */
import { describe, expect, it } from "vitest";
import { resolvePriceTokens } from "../pricing-tokens";

import {
  AUDIT_TIERS,
  UN_A_UN_RECURRING_TIER,
  UN_A_UN_TIERS,
  INTERVENTION_TIERS,
  formatPrice,
  formatTierPrice,
  formatSubTierPrice,
  getEntryLabel,
  getEntryPriceEur,
} from "../pricing";

const AUDIT_FLASH = AUDIT_TIERS.find((t) => t.id === "audit-flash")!;
const IDS_1TO1 = [
  "intervention-dirigeants",
  "intervention-membre-equipe",
  "intervention-dirigeant-vision",
  "intervention-dirigeant-vision-2j",
  "intervention-membre-equipe-2j",
];
const tiersMasques = [
  ...AUDIT_TIERS,
  ...INTERVENTION_TIERS.filter((t) => IDS_1TO1.includes(t.id)),
  UN_A_UN_RECURRING_TIER,
];

describe("audits et 1-to-1 : « Sur devis », jamais de montant", () => {
  it("couvre tous les audits, les 5 journées 1-to-1 et le coaching régulier", () => {
    expect(tiersMasques).toHaveLength(AUDIT_TIERS.length + IDS_1TO1.length + 1);
    for (const t of tiersMasques) expect(t.prixPublicMasque, t.id).toBe(true);
  });

  it("formatTierPrice rend « Sur devis » en FR et « On request » en EN", () => {
    for (const t of tiersMasques) {
      expect(formatTierPrice(t, "fr"), t.id).toMatch(/sur devis/i);
      expect(formatTierPrice(t, "fr"), t.id).not.toMatch(/\d/);
      expect(formatTierPrice(t, "en"), t.id).toMatch(/on (request|quote)/i);
    }
  });

  it("aucun sous-tier d'audit n'affiche de montant", () => {
    for (const t of AUDIT_TIERS) {
      for (const s of t.subTiers ?? []) {
        expect(s.prixPublicMasque, s.id).toBe(true);
        expect(formatSubTierPrice(s, "fr"), s.id).toMatch(/sur devis/i);
        expect(formatSubTierPrice(s, "fr"), s.id).not.toMatch(/\d/);
      }
    }
  });

  it("le libellé d'entrée n'est plus un montant ; le nombre brut reste lisible (JSON-LD)", () => {
    expect(getEntryLabel(AUDIT_TIERS, "fr")).toMatch(/sur devis/i);
    expect(getEntryLabel(UN_A_UN_TIERS, "fr")).toMatch(/sur devis/i);
    expect(getEntryPriceEur(AUDIT_TIERS)).toBe(1190);
  });

  it("formatPrice reste brut : le résolveur de devis et la prose des villes en dépendent", () => {
    expect(formatPrice(AUDIT_FLASH, "fr")).toMatch(/1.190/);
  });

  it("les montants internes sont CONSERVÉS (devis, réservation, barème apporteurs)", () => {
    expect(AUDIT_FLASH.priceFlat).toBe(1190);
    expect(AUDIT_FLASH.subTiers?.[0]?.priceFlat).toBe(1190);
    expect(UN_A_UN_TIERS.map((t) => t.priceFlat)).toEqual([990, 1390]);
    expect(UN_A_UN_RECURRING_TIER.priceFlat).toBe(790);
    // `onQuote` reste réservé aux tiers sans montant : la réservation en dépend.
    for (const t of tiersMasques) expect(t.onQuote, t.id).toBeUndefined();
  });

  it("les jetons {{price:…}} d’un palier masqué rendent « Sur devis », quel que soit le mode", () => {
    for (const jeton of [
      "{{price:audit-flash|from}}",
      "{{price:audit-cible|range}}",
      "{{price:intervention-membre-equipe|flat}}",
      "{{price:intervention-dirigeants|flat}}",
    ]) {
      const rendu = resolvePriceTokens(jeton, "fr");
      expect(rendu, jeton).toBe("Sur devis");
      expect(rendu).not.toMatch(/\d/);
    }
    expect(resolvePriceTokens("{{price:audit-flash|from}}", "en")).toBe("On request");
  });

  it("les formations d'un tier non masqué restent inchangées", () => {
    const f = INTERVENTION_TIERS.find((t) => t.id === "formation-generale-1j")!;
    expect(f.prixPublicMasque).toBeUndefined();
    expect(formatPrice(f, "fr")).toMatch(/\d/);
  });
});
