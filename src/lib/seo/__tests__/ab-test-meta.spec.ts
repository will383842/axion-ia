import { describe, it, expect } from "vitest";
import { selectMetaVariant, isUrlEligible } from "../ab-test-meta";

const VARIANT_A = { title: "Title A", description: "Desc A" };
const VARIANT_B = { title: "Title B", description: "Desc B" };

describe("Phase 13 A/B meta — selectMetaVariant déterministe par URL", () => {
  it("AB1: même URL retourne toujours le même variant (stable cross-request)", () => {
    const result1 = selectMetaVariant("/blog/article-1", VARIANT_A, VARIANT_B);
    const result2 = selectMetaVariant("/blog/article-1", VARIANT_A, VARIANT_B);
    expect(result1.label).toBe(result2.label);
    expect(result1.variant).toBe(result2.variant);
  });

  it("AB2: URLs différentes peuvent retourner des variants différents", () => {
    const labels = new Set<string>();
    for (let i = 0; i < 50; i++) {
      labels.add(selectMetaVariant(`/blog/article-${i}`, VARIANT_A, VARIANT_B).label);
    }
    // Sur 50 URLs, on attend les 2 labels (A et B) avec hash SHA-256 distribution.
    expect(labels.size).toBe(2);
  });

  it("AB3: retourne soit VARIANT_A soit VARIANT_B (jamais un objet random)", () => {
    const result = selectMetaVariant("/test", VARIANT_A, VARIANT_B);
    expect([VARIANT_A, VARIANT_B]).toContain(result.variant);
  });
});

describe("Phase 13 A/B meta — isUrlEligible patterns", () => {
  it("AB4: patterns vide → eligible (wildcard tout le site)", () => {
    expect(isUrlEligible("/anything", [])).toBe(true);
  });

  it("AB5: pattern wildcard suffixé /* → match préfixe", () => {
    expect(isUrlEligible("/blog/article-1", ["/blog/*"])).toBe(true);
    expect(isUrlEligible("/audit", ["/blog/*"])).toBe(false);
  });

  it("AB6: pattern exact → match URL identique uniquement", () => {
    expect(isUrlEligible("/audit", ["/audit"])).toBe(true);
    expect(isUrlEligible("/audit/tpe-1-jour", ["/audit"])).toBe(false);
  });

  it("AB7: pattern string vide dans array = wildcard global", () => {
    expect(isUrlEligible("/anything", [""])).toBe(true);
  });
});
