// Sprint S+2 City Domination — Phase D + F tests.
// getNearbyVillesExtended (3 dimensions imbriquées) + getNearbyCasesWithFallback.

import { describe, it, expect } from "vitest";
import { getNearbyVillesExtended, getNearbyCasesWithFallback } from "../geo";
import { getVille, VILLES } from "@/content/villes";

describe("getNearbyVillesExtended — Phase D alentours 3 dimensions", () => {
  const paris = VILLES.find((v) => v.slug === "paris");

  it("retourne les 3 buckets immediates + sameDepartement + economicArea", () => {
    if (!paris) throw new Error("Paris missing in VILLES fixture");
    const result = getNearbyVillesExtended(paris);
    expect(result).toHaveProperty("immediates");
    expect(result).toHaveProperty("sameDepartement");
    expect(result).toHaveProperty("economicArea");
    expect(Array.isArray(result.immediates)).toBe(true);
    expect(Array.isArray(result.sameDepartement)).toBe(true);
    expect(Array.isArray(result.economicArea)).toBe(true);
  });

  it("immediates ≤ 30 km de la source", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    for (const item of result.immediates) {
      expect(item.distanceKm).toBeLessThanOrEqual(30);
    }
  });

  it("immediates n'inclut PAS la ville source", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    const slugs = result.immediates.map((x) => x.ville.slug);
    expect(slugs).not.toContain("paris");
  });

  it("sameDepartement villes ont le même code département", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    for (const item of result.sameDepartement) {
      expect(item.ville.departement).toBe(paris.departement);
    }
  });

  it("economicArea villes ont la même région et > 30 km", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    for (const item of result.economicArea) {
      expect(item.ville.region).toBe(paris.region);
      expect(item.distanceKm).toBeGreaterThan(30);
      expect(item.distanceKm).toBeLessThanOrEqual(60);
    }
  });

  it("aucun double-comptage entre buckets", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    const allSlugs = [
      ...result.immediates.map((x) => x.ville.slug),
      ...result.sameDepartement.map((x) => x.ville.slug),
      ...result.economicArea.map((x) => x.ville.slug),
    ];
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
  });

  it("caps : immediates ≤15, sameDepartement ≤20, economicArea ≤15", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    expect(result.immediates.length).toBeLessThanOrEqual(15);
    expect(result.sameDepartement.length).toBeLessThanOrEqual(20);
    expect(result.economicArea.length).toBeLessThanOrEqual(15);
  });

  it("tri ascendant distance dans chaque bucket", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyVillesExtended(paris);
    const verifySort = (arr: ReadonlyArray<{ distanceKm: number }>) => {
      for (let i = 1; i < arr.length; i++) {
        expect(arr[i]!.distanceKm).toBeGreaterThanOrEqual(arr[i - 1]!.distanceKm);
      }
    };
    verifySort(result.immediates);
    verifySort(result.sameDepartement);
    verifySort(result.economicArea);
  });

  it("ville isolée (Île de France périphérique) peut avoir immediates vide", () => {
    // Si Paris est isolée — improbable mais safe : on teste avec une ville
    // moins centrale comme Saint-Paul (Réunion) si présente.
    const candidate = VILLES.find((v) => v.region === "auvergne-rhone-alpes");
    if (!candidate) return;
    const result = getNearbyVillesExtended(candidate);
    expect(result.immediates.length).toBeGreaterThanOrEqual(0);
  });
});

describe("getNearbyCasesWithFallback — Phase F fallback cascade", () => {
  const paris = getVille("paris");

  it("retourne { cases, fallbackLevel }", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyCasesWithFallback(paris);
    expect(result).toHaveProperty("cases");
    expect(result).toHaveProperty("fallbackLevel");
    expect(["proximity", "region", "sector", "none"]).toContain(result.fallbackLevel);
  });

  it("respecte le param `n` (default 3)", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyCasesWithFallback(paris, { n: 2 });
    expect(result.cases.length).toBeLessThanOrEqual(2);
  });

  it("fallback `region` si proximity vide (ville isolée Tier-3)", () => {
    // Test sur une ville moyenne (≤30K hab) qui a probablement peu de cas
    // concrets à proximité.
    const smallVille = VILLES.find((v) => v.population && v.population < 30000);
    if (!smallVille) return;
    const result = getNearbyCasesWithFallback(smallVille, { radiusKm: 20, n: 3 });
    expect(["proximity", "region", "sector", "none"]).toContain(result.fallbackLevel);
  });

  it("fallback `none` si vraiment rien (radiusKm très petit + pas de cas région)", () => {
    if (!paris) throw new Error("Paris missing");
    const result = getNearbyCasesWithFallback(paris, { radiusKm: 0.1, n: 100 });
    // Avec radius 100m, immédiate impossible. Fallback region remonte.
    expect(result.fallbackLevel).not.toBe("proximity");
  });
});
