import { describe, it, expect } from "vitest";
import {
  LOCAL_CITATIONS_FR,
  buildLocalBusinessSameAsFR,
  getLocalCitationsCoverage,
} from "../local-citations";

describe("Phase 14 Local SEO citations FR", () => {
  it("LC1: LOCAL_CITATIONS_FR contient ≥ 10 annuaires FR", () => {
    expect(LOCAL_CITATIONS_FR.length).toBeGreaterThanOrEqual(10);
  });

  it("LC2: chaque entry a slug + name + directoryUrl + priority + category", () => {
    for (const entry of LOCAL_CITATIONS_FR) {
      expect(entry.slug).toBeDefined();
      expect(entry.name).toBeDefined();
      expect(entry.directoryUrl).toMatch(/^https?:\/\//);
      expect([1, 2, 3, 4, 5]).toContain(entry.priority);
      expect(entry.category).toBeDefined();
    }
  });

  it("LC3: slugs uniques (anti-doublon catalog)", () => {
    const slugs = LOCAL_CITATIONS_FR.map((c) => c.slug);
    const uniques = new Set(slugs);
    expect(uniques.size).toBe(slugs.length);
  });

  it("LC4: priorité 1 inclut PagesJaunes + Google Business + Bing Places (NAP critique)", () => {
    const p1Slugs = LOCAL_CITATIONS_FR.filter((c) => c.priority === 1).map((c) => c.slug);
    expect(p1Slugs).toContain("pages-jaunes");
    expect(p1Slugs).toContain("google-business");
    expect(p1Slugs).toContain("bing-places");
  });

  it("LC5: buildLocalBusinessSameAsFR retourne [] tant que listingUrl=null (V1 défaut)", () => {
    expect(buildLocalBusinessSameAsFR()).toEqual([]);
  });

  it("LC6: getLocalCitationsCoverage retourne stats cohérentes (total=10+, listed=0 V1)", () => {
    const cov = getLocalCitationsCoverage();
    expect(cov.total).toBeGreaterThanOrEqual(10);
    expect(cov.listed).toBe(0);
    // Au moins une entrée en priorité 1.
    expect(cov.byPriority[1].total).toBeGreaterThanOrEqual(3);
    expect(cov.byPriority[1].listed).toBe(0);
  });
});
