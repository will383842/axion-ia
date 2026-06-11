/**
 * Anti-drift SSOT « squelette formation ».
 *
 * Verrouille que la durée + le public + les modalités ne dérivent PAS entre le
 * squelette (source unique) et : pricing.ts, le seed Qualiopi OffreSite, la
 * taxonomy, interventions.ts, subpages (JSON-LD). Modèle : offers-catalog.test.ts
 * — on lit les SSOT, jamais de littéral (sauf garde-fous ISO explicitement figés).
 */

import { describe, it, expect } from "vitest";
import {
  FORMATION_DURATIONS,
  FORMATION_SKELETONS,
  getDurationCanonical,
  getSkeletonByTier,
  getSkeletonBySlug,
  formationDurationIso,
  formationDurationDays,
} from "@/content/formations";
import { INTERVENTION_TIERS } from "@/content/pricing";
import { OFFRES_SEED } from "../../../prisma/seeds/qualiopi/offres";

describe("squelette — cohérence interne", () => {
  it("chaque tierId existe dans INTERVENTION_TIERS (pricing.ts)", () => {
    const known = new Set(INTERVENTION_TIERS.map((t) => t.id));
    for (const s of FORMATION_SKELETONS) {
      expect(known.has(s.tierId), `${s.id} → tier inconnu "${s.tierId}"`).toBe(true);
    }
  });

  it("heures cohérentes (min ≤ max, > 0) et archetype durée résoluble", () => {
    for (const s of FORMATION_SKELETONS) {
      expect(s.hoursMin, s.id).toBeGreaterThan(0);
      expect(s.hoursMin, s.id).toBeLessThanOrEqual(s.hoursMax);
      expect(() => getDurationCanonical(s.duration), s.id).not.toThrow();
    }
  });

  it("ids, slugs FR et tierId uniques", () => {
    const ids = FORMATION_SKELETONS.map((s) => s.id);
    const slugs = FORMATION_SKELETONS.map((s) => s.slugFr);
    const tiers = FORMATION_SKELETONS.map((s) => s.tierId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it("programme (si présent) : ≥ 1 jour, ≥ 1 item, bilingue", () => {
    for (const s of FORMATION_SKELETONS) {
      if (!s.programme) continue;
      expect(s.programme.days.length, s.id).toBeGreaterThanOrEqual(1);
      for (const day of s.programme.days) {
        expect(day.items.length, s.id).toBeGreaterThanOrEqual(1);
        for (const it of day.items) {
          expect(it.titleFr.length, s.id).toBeGreaterThan(0);
          expect(it.titleEn.length, s.id).toBeGreaterThan(0);
        }
      }
    }
  });

  it("archetypes : ISO présent sauf palier sur devis (3-jours-plus)", () => {
    for (const [id, d] of Object.entries(FORMATION_DURATIONS)) {
      if (id === "3-jours-plus") expect(d.iso).toBeNull();
      else expect(d.iso, id).toMatch(/^P/);
    }
  });
});

describe("squelette — couverture des 5 formations marketing (InterventionSlug)", () => {
  // Les 5 slugs de interventions.ts:InterventionSlug doivent avoir un squelette.
  for (const slug of [
    "essentielle",
    "approfondie",
    "dirigeants",
    "gagner-du-temps",
    "intervention-claude",
  ]) {
    it(`"${slug}" a un squelette`, () => {
      expect(getSkeletonBySlug(slug), slug).toBeDefined();
    });
  }
});

describe("squelette — garde-fous ISO figés (décision 2026-06-11 : 1 jour = PT7H)", () => {
  it("essentielle = PT7H", () => expect(formationDurationIso("essentielle")).toBe("PT7H"));
  it("gagner-du-temps = PT7H", () => expect(formationDurationIso("gagner-du-temps")).toBe("PT7H"));
  it("intervention-claude = PT7H", () =>
    expect(formationDurationIso("intervention-claude")).toBe("PT7H"));
  it("approfondie = P2D", () => expect(formationDurationIso("approfondie")).toBe("P2D"));
  it("demarrage-ia-express = PT4H", () =>
    expect(formationDurationIso("demarrage-ia-express")).toBe("PT4H"));
  it("days cohérents", () => {
    expect(formationDurationDays("essentielle")).toBe(1);
    expect(formationDurationDays("approfondie")).toBe(2);
    expect(formationDurationDays("demarrage-ia-express")).toBe(0.5);
  });
});

describe("squelette — pont Qualiopi : seed OffreSite == squelette (0 dérive durée/public)", () => {
  it("chaque offre seedée correspond à son squelette (heures, public, modalités)", () => {
    for (const offre of OFFRES_SEED) {
      const s = getSkeletonByTier(offre.tierId);
      // Toute offre seedée DOIT avoir un squelette (le squelette est la source).
      expect(s, `offre tier "${offre.tierId}" sans squelette`).toBeDefined();
      if (!s) continue;
      expect(offre.dureeHeuresMin, offre.tierId).toBe(s.hoursMin);
      expect(offre.dureeHeuresMax, offre.tierId).toBe(s.hoursMax);
      expect(offre.publicViseFr, offre.tierId).toBe(s.publicViseFr);
      expect([...offre.modalites].sort(), offre.tierId).toEqual([...s.modalites].sort());
    }
  });
});
