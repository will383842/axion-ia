import { describe, it, expect } from "vitest";
import {
  META_LENGTH,
  META_TITLE_RULE,
  META_DESCRIPTION_RULE,
  DIRECT_ANSWER_RULE,
  countWords,
  clampToWordBoundary,
} from "./meta-length";

describe("META_LENGTH (seuils canoniques)", () => {
  it("expose les fourchettes attendues par l'audit", () => {
    expect(META_LENGTH.metaTitle).toEqual({ min: 50, max: 60 });
    expect(META_LENGTH.metaDescription).toEqual({ min: 140, max: 160 });
    expect(META_LENGTH.directAnswerWords).toEqual({ min: 40, max: 80 });
  });

  it("interpole les seuils dans les blocs de directive (plancher + plafond)", () => {
    expect(META_TITLE_RULE).toContain("50");
    expect(META_TITLE_RULE).toContain("60");
    expect(META_DESCRIPTION_RULE).toContain("140");
    expect(META_DESCRIPTION_RULE).toContain("160");
    expect(DIRECT_ANSWER_RULE).toContain("40");
    expect(DIRECT_ANSWER_RULE).toContain("80");
  });
});

describe("countWords", () => {
  it("compte les mots et tolère les espaces multiples", () => {
    expect(countWords("un deux trois")).toBe(3);
    expect(countWords("  un   deux  ")).toBe(2);
  });

  it("renvoie 0 pour null/undefined/vide", () => {
    expect(countWords(null)).toBe(0);
    expect(countWords(undefined)).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("clampToWordBoundary", () => {
  it("renvoie le texte inchangé sous la limite", () => {
    expect(clampToWordBoundary("court", 20)).toBe("court");
  });

  it("coupe au dernier mot complet avec ellipse", () => {
    const out = clampToWordBoundary("alpha beta gamma delta", 14);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(14);
    expect(out).not.toContain("gam");
  });

  it("ne coupe pas au milieu si aucun espace tardif (fallback dur)", () => {
    const out = clampToWordBoundary("mottreslongsansespace", 10);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.endsWith("…")).toBe(true);
  });
});
