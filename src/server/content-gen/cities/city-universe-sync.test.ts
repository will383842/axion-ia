import { describe, it, expect } from "vitest";
import { buildCityUniverseRows, populationTier, type VilleLike } from "./city-universe-sync";

function ville(partial: Partial<VilleLike> & { slug: string; population: number }): VilleLike {
  return {
    nameFr: partial.slug,
    region: "ile-de-france",
    departement: "75",
    inseeCode: `insee-${partial.slug}`,
    geo: { lat: 48.8, lon: 2.3 },
    ...partial,
  };
}

describe("populationTier", () => {
  it("classe selon les paliers du schéma City", () => {
    expect(populationTier(2_000_000)).toBe(1);
    expect(populationTier(100_000)).toBe(1);
    expect(populationTier(99_999)).toBe(2);
    expect(populationTier(20_000)).toBe(2);
    expect(populationTier(10_000)).toBe(3);
    expect(populationTier(9_999)).toBe(4);
    expect(populationTier(5_000)).toBe(4);
  });
});

describe("buildCityUniverseRows", () => {
  it("trie par population décroissante et attribue priority/rank (Paris = 1)", () => {
    const { cityRows, orderRows } = buildCityUniverseRows([
      ville({ slug: "petite", population: 8_000 }),
      ville({ slug: "paris", population: 2_000_000 }),
      ville({ slug: "moyenne", population: 50_000 }),
    ]);
    expect(cityRows.map((c) => c.slug)).toEqual(["paris", "moyenne", "petite"]);
    expect(cityRows.map((c) => c.priority)).toEqual([1, 2, 3]);
    expect(orderRows.map((o) => o.rank)).toEqual([1, 2, 3]);
  });

  it("dérive tier + tier string cohérents", () => {
    const { cityRows, orderRows } = buildCityUniverseRows([
      ville({ slug: "grande", population: 150_000 }),
      ville({ slug: "petite", population: 7_000 }),
    ]);
    expect(cityRows[0]!.populationTier).toBe(1);
    expect(orderRows[0]!.tier).toBe("T1");
    expect(cityRows[1]!.populationTier).toBe(4);
    expect(orderRows[1]!.tier).toBe("T4");
  });

  it("résout regionName depuis REGIONS, fallback = slug région si inconnue", () => {
    const { cityRows } = buildCityUniverseRows([
      ville({ slug: "a", population: 30_000, region: "ile-de-france" }),
      ville({ slug: "b", population: 20_000, region: "region-inexistante-xyz" }),
    ]);
    expect(cityRows[0]!.regionName).toBe("Île-de-France");
    expect(cityRows[1]!.regionName).toBe("region-inexistante-xyz");
  });

  it("mappe hasEconomicData depuis la présence de economicData", () => {
    const { cityRows } = buildCityUniverseRows([
      ville({ slug: "avec", population: 30_000, economicData: { foo: 1 } }),
      ville({ slug: "sans", population: 20_000 }),
    ]);
    const avec = cityRows.find((c) => c.slug === "avec")!;
    const sans = cityRows.find((c) => c.slug === "sans")!;
    expect(avec.hasEconomicData).toBe(true);
    expect(sans.hasEconomicData).toBe(false);
  });

  it("utilise departementLabel si présent, sinon le code département", () => {
    const { cityRows } = buildCityUniverseRows([
      ville({ slug: "a", population: 30_000, departement: "69", departementLabel: "Rhône" }),
      ville({ slug: "b", population: 20_000, departement: "75" }),
    ]);
    expect(cityRows.find((c) => c.slug === "a")!.departmentName).toBe("Rhône");
    expect(cityRows.find((c) => c.slug === "b")!.departmentName).toBe("75");
  });
});
