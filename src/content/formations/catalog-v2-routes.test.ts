/**
 * Intégrité des routes /formations — anti-collision de namespace.
 * Garantit qu'aucun slug de formation ne percute un segment statique
 * (/tarifs, /duree, /gamme) ni un slug de durée/gamme, et réciproquement.
 */

import { describe, it, expect } from "vitest";
import { FORMATIONS_V2 } from "./catalog-v2";
import { FORMATION_DUREES_META, FORMATION_GAMMES_META } from "./catalog-v2-meta";

/** Segments statiques sous /formations/ (prioritaires sur [slug]). */
const RESERVED_SEGMENTS = new Set([
  "tarifs",
  "duree",
  "gamme",
  "metiers",
  "secteurs",
  "entreprise",
  "par-ville",
]);

describe("routes /formations — anti-collision", () => {
  const formationSlugs = new Set(FORMATIONS_V2.flatMap((f) => [f.slugFr, f.slugEn]));
  const dureeSlugs = FORMATION_DUREES_META.map((d) => d.slug);
  const gammeSlugs = FORMATION_GAMMES_META.map((g) => g.slug);

  it("aucun slug de formation n'est un segment réservé", () => {
    for (const f of FORMATIONS_V2) {
      expect(RESERVED_SEGMENTS.has(f.slugFr), f.slugFr).toBe(false);
      expect(RESERVED_SEGMENTS.has(f.slugEn), f.slugEn).toBe(false);
    }
  });

  it("les slugs de durée ne percutent aucun slug de formation", () => {
    for (const s of dureeSlugs) expect(formationSlugs.has(s), s).toBe(false);
  });

  it("les slugs de gamme ne percutent aucun slug de formation", () => {
    for (const s of gammeSlugs) expect(formationSlugs.has(s), s).toBe(false);
  });

  it("tous les slugs (formations + durées + gammes) sont uniques entre eux", () => {
    const all = [...FORMATIONS_V2.map((f) => f.slugFr), ...dureeSlugs, ...gammeSlugs];
    expect(new Set(all).size).toBe(all.length);
  });
});
