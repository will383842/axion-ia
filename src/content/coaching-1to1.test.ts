/**
 * Tests — SSOT des faits partagés coaching 1-to-1 (WS7).
 *
 * Vérifie que les résolveurs de chemins dérivent FIDÈLEMENT la taxonomie
 * (familyPath/formatPath) et que chaque tier de prix référencé existe. C'est le
 * garde anti-drift : si un path taxonomie change, les sources (un-a-un,
 * booking-catalog) restent alignées via ce module ; si un mapping casse, ce
 * test échoue.
 */

import { describe, it, expect } from "vitest";
import {
  COACHING_1TO1_FORMULES,
  COACHING_1TO1_FORMATS,
  COACHING_1TO1_ISO_DURATION,
  coachingFormulePath,
  coachingFormatPath,
} from "./coaching-1to1";
import {
  INTERVENTION_FORMATS,
  getFamily,
  familyPath,
  formatPath,
} from "./interventions-taxonomy";
import { INTERVENTION_TIERS, UN_A_UN_RECURRING_TIER, getTierById } from "./pricing";

const ALL_TIERS = [...INTERVENTION_TIERS, UN_A_UN_RECURRING_TIER];

describe("coaching-1to1 — formules (hub)", () => {
  for (const formule of COACHING_1TO1_FORMULES) {
    it(`${formule.id} : chemins = famille taxonomie ${formule.family}`, () => {
      const fam = getFamily(formule.family);
      expect(coachingFormulePath(formule.id, "fr")).toBe(familyPath(fam, "fr"));
      expect(coachingFormulePath(formule.id, "en")).toBe(familyPath(fam, "en"));
    });

    it(`${formule.id} : tier de prix existe`, () => {
      expect(getTierById(ALL_TIERS, formule.priceTierId)).toBeDefined();
    });
  }
});

describe("coaching-1to1 — formats (réservation)", () => {
  for (const fmt of COACHING_1TO1_FORMATS) {
    it(`${fmt.slug} : chemins = format taxonomie ${fmt.taxonomySlug}`, () => {
      const entry = INTERVENTION_FORMATS.find((e) => e.slug === fmt.taxonomySlug);
      expect(entry).toBeDefined();
      expect(coachingFormatPath(fmt.slug, "fr")).toBe(formatPath(entry!, "fr"));
      expect(coachingFormatPath(fmt.slug, "en")).toBe(formatPath(entry!, "en"));
    });

    it(`${fmt.slug} : tier de prix existe`, () => {
      expect(getTierById(ALL_TIERS, fmt.priceTierId)).toBeDefined();
    });
  }
});

describe("coaching-1to1 — garde-fous", () => {
  it("durée ISO canonique = PT7H", () => {
    expect(COACHING_1TO1_ISO_DURATION).toBe("PT7H");
  });

  it("slug inconnu → throw explicite", () => {
    expect(() => coachingFormatPath("inexistant", "fr")).toThrow();
  });
});
