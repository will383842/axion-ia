/**
 * Garde de la liste unique des villes indexées (`villes-indexees.ts`, 18/11/2026).
 * 59 pages locales indexées = 1 hub + 18 régions + 40 villes (≥ 100 000 habitants).
 */
import { describe, it, expect } from "vitest";

import { VILLES_INDEXEES_SLUGS, VILLES_INDEXEES, estCitableDansLeMaillage } from "../villes-indexees";
import { VILLES_CORE, isVilleIndexable, getIndexableVillesCore } from "../core";
import { getIndexableRegions } from "@/content/regions";

const ATTENDUES = [
  "paris", "saint-denis", "boulogne-billancourt", "montreuil", "argenteuil",
  "marseille", "nice", "toulon", "aix-en-provence",
  "lyon", "saint-etienne", "villeurbanne", "grenoble", "clermont-ferrand", "annecy",
  "toulouse", "montpellier", "nimes", "perpignan",
  "nantes", "angers", "le-mans",
  "strasbourg", "reims", "metz", "mulhouse", "nancy",
  "bordeaux", "limoges",
  "lille", "amiens",
  "rennes", "brest",
  "le-havre", "rouen", "caen",
  "dijon", "besancon",
  "tours", "orleans",
];

describe("villes-indexees · la liste contient exactement les pages prévues", () => {
  it("40 villes, sans doublon, exactement celles attendues", () => {
    expect(VILLES_INDEXEES_SLUGS).toHaveLength(40);
    expect(new Set(VILLES_INDEXEES_SLUGS).size).toBe(40);
    expect([...VILLES_INDEXEES_SLUGS].sort()).toEqual([...ATTENDUES].sort());
  });

  it("59 pages locales : hub + 18 régions + 40 villes", () => {
    expect(getIndexableRegions()).toHaveLength(18);
    expect(1 + getIndexableRegions().length + VILLES_INDEXEES_SLUGS.length).toBe(59);
  });

  it("chaque ville existe, a 100 000 habitants ou plus", () => {
    for (const slug of VILLES_INDEXEES_SLUGS) {
      const v = VILLES_CORE.find((x) => x.slug === slug);
      expect(v, `ville inconnue : ${slug}`).toBeDefined();
      expect(v!.population, slug).toBeGreaterThanOrEqual(100_000);
    }
  });

  it("toutes les communes de 100 000 habitants ou plus sont dans la liste (pas d'Ajaccio)", () => {
    const grandes = VILLES_CORE.filter((v) => v.population >= 100_000).map((v) => v.slug);
    expect([...grandes].sort()).toEqual([...VILLES_INDEXEES_SLUGS].sort());
    expect(VILLES_INDEXEES.has("ajaccio")).toBe(false);
  });

  it("isVilleIndexable est vrai pour la liste et faux pour toutes les autres villes", () => {
    for (const v of VILLES_CORE) {
      expect(isVilleIndexable(v.slug), v.slug).toBe(VILLES_INDEXEES.has(v.slug));
    }
    for (const slug of ["acheres", "poitiers", "ajaccio", "versailles"]) {
      expect(isVilleIndexable(slug), slug).toBe(false);
    }
    for (const slug of ["paris", "lyon", "brest", "le-havre", "montreuil", "grenoble"]) {
      expect(isVilleIndexable(slug), slug).toBe(true);
    }
  });

  it("Grenoble est hors maillage national, les autres villes sont citables", () => {
    expect(estCitableDansLeMaillage("grenoble")).toBe(false);
    expect(estCitableDansLeMaillage("lyon")).toBe(true);
  });

  it("le maillage du hub France ne cite pas Grenoble", () => {
    const principales = getIndexableVillesCore().filter((v) => estCitableDansLeMaillage(v.slug));
    expect(principales.map((v) => v.slug)).not.toContain("grenoble");
  });
});
