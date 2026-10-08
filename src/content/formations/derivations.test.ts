/**
 * Anti-drift TRANSVERSE — verrouille que toutes les couches DÉRIVENT bien du
 * SSOT squelette (et ne re-divergent jamais) : taxonomy (iso8601) et booking-catalog
 * (jours de blocage). Complète skeletons.test.ts (cohérence interne + seed).
 * (2026-10-08 : interventions.ts et interventions-subpages.ts, contenus des anciennes
 * formules à prix erronés qu'aucune page ne rendait plus, sont supprimés.)
 *
 * Si un de ces tests casse, c'est qu'une couche a recommencé à hardcoder une
 * durée au lieu de la lire depuis `@/content/formations`.
 */

import { describe, it, expect } from "vitest";
import { getDurationCanonical, getSkeletonBySlug } from "@/content/formations";
import { COLLECTIVE_DURATIONS } from "@/content/interventions-taxonomy";
import { BOOKING_CATALOG } from "@/content/booking-catalog";

describe("taxonomy — iso8601Duration dérivé de l'archetype", () => {
  for (const d of COLLECTIVE_DURATIONS) {
    it(`palier ${d.id}`, () => {
      const iso = getDurationCanonical(d.id).iso;
      if (iso === null) expect(d.iso8601Duration).toBeUndefined();
      else expect(d.iso8601Duration).toBe(iso);
    });
  }
});

describe("booking-catalog — durationDays cohérent avec l'archetype (ceil des jours)", () => {
  const formats = BOOKING_CATALOG.flatMap((c) => c.formats);
  for (const f of formats) {
    const s = getSkeletonBySlug(f.slug);
    if (!s) continue; // audits / coaching sur devis : hors squelette
    it(`${f.slug} : durationDays == ceil(archetype.days)`, () => {
      const expected = Math.ceil(getDurationCanonical(s.duration).days);
      expect(f.durationDays).toBe(expected);
    });
  }
});
