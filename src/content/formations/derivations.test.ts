/**
 * Anti-drift TRANSVERSE — verrouille que toutes les couches DÉRIVENT bien du
 * SSOT squelette (et ne re-divergent jamais) : interventions.ts (durée +
 * daySchedule), taxonomy (iso8601), subpages (Course JSON-LD), booking-catalog
 * (jours de blocage). Complète skeletons.test.ts (cohérence interne + seed).
 *
 * Si un de ces tests casse, c'est qu'une couche a recommencé à hardcoder une
 * durée au lieu de la lire depuis `@/content/formations`.
 */

import { describe, it, expect } from "vitest";
import {
  formationDurationIso,
  formationDurationDays,
  getDurationCanonical,
  getSkeletonBySlug,
} from "@/content/formations";
import { getIntervention, type InterventionSlug } from "@/content/interventions";
import { COLLECTIVE_DURATIONS } from "@/content/interventions-taxonomy";
import { FORMATION_DURATION_ISO } from "@/content/interventions-subpages";
import { BOOKING_CATALOG } from "@/content/booking-catalog";

const MARKETING_SLUGS: ReadonlyArray<InterventionSlug> = [
  "essentielle",
  "approfondie",
  "dirigeants",
  "gagner-du-temps",
  "intervention-claude",
];

describe("interventions.ts — durée + jours dérivés du squelette", () => {
  for (const slug of MARKETING_SLUGS) {
    it(`${slug} : summary.duration/durationDays == squelette (fr+en)`, () => {
      const s = getSkeletonBySlug(slug);
      expect(s, slug).toBeDefined();
      if (!s) return;
      const iv = getIntervention(slug);
      const days = formationDurationDays(slug);
      expect(iv.summary.fr.durationDays).toBe(days);
      expect(iv.summary.en.durationDays).toBe(days);
      expect(iv.summary.fr.duration).toBe(s.summaryDurationFr);
      expect(iv.summary.en.duration).toBe(s.summaryDurationEn);
    });
  }

  it("essentielle & dirigeants : daySchedule dérivé du programme (non vide, bilingue)", () => {
    for (const slug of ["essentielle", "dirigeants"] as const) {
      const iv = getIntervention(slug);
      expect(iv.fr.daySchedule?.days[0]?.items.length, `${slug} fr`).toBeGreaterThan(0);
      expect(iv.en.daySchedule?.days[0]?.items.length, `${slug} en`).toBeGreaterThan(0);
      // Le programme du squelette et le daySchedule rendu ont le même nb d'items.
      const prog = getSkeletonBySlug(slug)?.programme;
      expect(iv.fr.daySchedule?.days[0]?.items.length).toBe(prog?.days[0]?.items.length);
    }
  });
});

describe("taxonomy — iso8601Duration dérivé de l'archetype", () => {
  for (const d of COLLECTIVE_DURATIONS) {
    it(`palier ${d.id}`, () => {
      const iso = getDurationCanonical(d.id).iso;
      if (iso === null) expect(d.iso8601Duration).toBeUndefined();
      else expect(d.iso8601Duration).toBe(iso);
    });
  }
});

describe("subpages — FORMATION_DURATION_ISO dérivé du squelette (fin de la dérive PT8H)", () => {
  for (const [slug, iso] of Object.entries(FORMATION_DURATION_ISO)) {
    it(`${slug} = ${iso}`, () => {
      expect(iso).toBe(formationDurationIso(slug));
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
