import { describe, it, expect } from "vitest";
import { readabilityFitScore } from "../readability";
import { computeSeoScore, type SeoScoreInput } from "../seo-score";

describe("readabilityFitScore — bande B2B (anti-dilution)", () => {
  it("crédite pleinement une densité professionnelle (≥60 = idéal-b2b)", () => {
    expect(readabilityFitScore(60)).toBe(100);
    expect(readabilityFitScore(75)).toBe(100);
    expect(readabilityFitScore(100)).toBe(100);
  });

  it("crédite généreusement la bande 30-60 (contenu IA B2B « difficile » mais approprié)", () => {
    // Le contenu mesuré scorait ~43 (Flesch) → fitness ~83, plus du tout 43.
    expect(readabilityFitScore(43)).toBe(83);
    expect(readabilityFitScore(51)).toBe(91);
    expect(readabilityFitScore(30)).toBe(70);
  });

  it("dégrade seulement quand c'est vraiment illisible (<30)", () => {
    expect(readabilityFitScore(20)).toBeLessThan(70);
    expect(readabilityFitScore(0)).toBe(0);
  });

  it("borne [0,100]", () => {
    expect(readabilityFitScore(200)).toBe(100);
    expect(readabilityFitScore(-10)).toBe(0);
  });
});

describe("computeSeoScore — crédit SEO page-level (hasPageH1)", () => {
  const base: SeoScoreInput = {
    title: "Audit IA pour PME à Grenoble : méthode et bénéfices concrets",
    metaDescription: "x".repeat(150),
    bodyHtml: "<h2>Section</h2><p>contenu sans h1 (sanitizer FORBID h1 dans le body)</p>",
    bodyText: "contenu sans h1",
    primaryKeyword: "audit ia",
    contentKind: "article",
  };

  it("sans hasPageH1 : le body sans <h1> perd les 8 pts H1", () => {
    const r = computeSeoScore(base);
    const h1 = r.breakdown.find((c) => c.criterion === "H1 unique")!;
    expect(h1.got).toBe(0);
  });

  it("avec hasPageH1 : le H1 page-level (titre) est crédité (8 pts)", () => {
    const r = computeSeoScore({ ...base, hasPageH1: true });
    const h1 = r.breakdown.find((c) => c.criterion === "H1 unique")!;
    expect(h1.got).toBe(8);
  });

  it("hasPageH1 crédite aussi le mot-clé-dans-H1 (le titre EST le h1)", () => {
    // Le titre contient « audit ia » → +4 sur le critère mot-clé.
    const withFlag = computeSeoScore({ ...base, hasPageH1: true });
    const without = computeSeoScore(base);
    const kwWith = withFlag.breakdown.find((c) => c.criterion.startsWith("Primary KW"))!.got;
    const kwWithout = without.breakdown.find((c) => c.criterion.startsWith("Primary KW"))!.got;
    expect(kwWith).toBeGreaterThan(kwWithout);
  });

  it("un double <h1> dans le body reste pénalisé même avec hasPageH1 (anti-abus)", () => {
    const r = computeSeoScore({
      ...base,
      bodyHtml: "<h1>a</h1><h1>b</h1><p>x</p>",
      hasPageH1: true,
    });
    const h1 = r.breakdown.find((c) => c.criterion === "H1 unique")!;
    expect(h1.got).toBe(3); // 2 h1 → pénalité conservée
  });
});
