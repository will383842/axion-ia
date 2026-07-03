import { describe, expect, it } from "vitest";

import {
  VILLES,
  getRegionByDepartement,
  getVille,
  getVillesByDepartement,
  getVillesByRegion,
  getIndexableVilles,
  isPremiumVille,
  isVilleIndexable,
} from "./index";

/**
 * P2-4 Sprint S+5 — tests des deux helpers villes/département/région.
 *
 * Garanties testées :
 * - getVillesByDepartement renvoie les villes du bon code (75, 13, 2A…).
 * - Cas inconnu → tableau vide (jamais throw).
 * - getRegionByDepartement retrouve la région pour un code connu.
 * - Cas inconnu → undefined (jamais throw).
 * - Cohérence : chaque ville renvoyée doit appartenir à la région retournée.
 */

describe("getVillesByDepartement", () => {
  it("retourne au moins Paris pour le code 75", () => {
    const villes = getVillesByDepartement("75");
    expect(villes.length).toBeGreaterThanOrEqual(1);
    expect(villes.some((v) => v.slug === "paris")).toBe(true);
    expect(villes.every((v) => v.departement === "75")).toBe(true);
  });

  it("retourne plusieurs villes pour le département 13 (Bouches-du-Rhône)", () => {
    const villes = getVillesByDepartement("13");
    expect(villes.length).toBeGreaterThanOrEqual(1);
    expect(villes.every((v) => v.departement === "13")).toBe(true);
  });

  it("renvoie un tableau vide pour un code département inconnu (jamais throw)", () => {
    expect(getVillesByDepartement("999")).toEqual([]);
    expect(getVillesByDepartement("")).toEqual([]);
  });
});

describe("getRegionByDepartement", () => {
  it("retourne Île-de-France pour 75", () => {
    const region = getRegionByDepartement("75");
    expect(region).toBeDefined();
    expect(region?.slug).toBe("ile-de-france");
    expect(region?.departements).toContain("75");
  });

  it("retourne Provence-Alpes-Côte d'Azur pour 13", () => {
    const region = getRegionByDepartement("13");
    expect(region).toBeDefined();
    expect(region?.slug).toBe("provence-alpes-cote-d-azur");
  });

  it("supporte les codes département alphanumériques (Corse 2A/2B)", () => {
    const region2a = getRegionByDepartement("2A");
    const region2b = getRegionByDepartement("2B");
    expect(region2a?.slug).toBe("corse");
    expect(region2b?.slug).toBe("corse");
  });

  it("retourne undefined pour un code département inconnu (jamais throw)", () => {
    expect(getRegionByDepartement("999")).toBeUndefined();
    expect(getRegionByDepartement("")).toBeUndefined();
  });
});

describe("cohérence helpers ville/département/région", () => {
  it("chaque ville retournée par getVillesByDepartement appartient à la région donnée par getRegionByDepartement", () => {
    const codesEchantillon = ["75", "13", "69", "33", "59"];
    for (const code of codesEchantillon) {
      const villes = getVillesByDepartement(code);
      const region = getRegionByDepartement(code);
      if (villes.length === 0 || !region) continue;
      for (const v of villes) {
        expect(v.region).toBe(region.slug);
      }
    }
  });

  it("getVillesByDepartement('75') est un sous-ensemble de getVillesByRegion('ile-de-france')", () => {
    const dept = getVillesByDepartement("75");
    const region = getVillesByRegion("ile-de-france");
    const regionSlugs = new Set(region.map((v) => v.slug));
    for (const v of dept) {
      expect(regionSlugs.has(v.slug)).toBe(true);
    }
  });

  it("ne retourne que des villes dont la ville parente existe via getVille()", () => {
    const villes = getVillesByDepartement("75");
    for (const v of villes) {
      expect(getVille(v.slug)?.slug).toBe(v.slug);
    }
    expect(VILLES.length).toBeGreaterThan(0);
  });
});

describe("cap indexation T1/T2 + curées (P0 2026-07-03)", () => {
  const indexable = getIndexableVilles().filter((v) => isVilleIndexable(v.slug));

  it("indexe au moins toutes les grosses villes (pop ≥ 20k)", () => {
    expect(indexable.length).toBeGreaterThanOrEqual(400);
    expect(isVilleIndexable("paris")).toBe(true);
  });

  it("INVARIANT : toute ville indexable est premium (pop ≥ 20k OU réécrite gold)", () => {
    expect(indexable.every((v) => isPremiumVille(v))).toBe(true);
  });

  it("une petite ville non-premium (pop < 20k, non curée) n'est PAS indexable", () => {
    const small = VILLES.find((v) => !!v.copy && v.population < 20_000 && !isPremiumVille(v));
    // garde-fou : si le dataset venait à ne plus contenir de petite ville non-premium
    if (small) expect(isVilleIndexable(small.slug)).toBe(false);
  });
});
