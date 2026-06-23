import { describe, it, expect } from "vitest";
import {
  PRESS_PITCH,
  PRESS_FACTS,
  PRESS_KIT_ASSETS,
  PRESS_RELEASES,
  PRESS_MEDIA_COVERAGE,
  PRESS_SPOKESPERSONS,
  PRESS_FAQ,
  getPressRelease,
  getAllPressReleaseSlugs,
} from "./press";

const LOCALES = ["fr", "en"] as const;

describe("press · pitch", () => {
  it.each(LOCALES)("provides eyebrow + short + boilerplate for %s", (loc) => {
    const pitch = PRESS_PITCH[loc];
    expect(pitch.eyebrow.length).toBeGreaterThan(8);
    expect(pitch.short.length).toBeGreaterThan(120);
    expect(pitch.boilerplate.length).toBeGreaterThan(120);
  });

  it("does not contain forbidden FR legal terms (anti-siren)", () => {
    const blob = JSON.stringify(PRESS_PITCH);
    expect(blob).not.toMatch(/\bSIREN\b|\bSIRET\b|\bRCS\b/i);
  });
});

describe("press · facts", () => {
  it("has at least 6 fact rows for FR + EN parity", () => {
    expect(PRESS_FACTS.length).toBeGreaterThanOrEqual(6);
    for (const fact of PRESS_FACTS) {
      expect(fact.fr.label.length).toBeGreaterThan(0);
      expect(fact.fr.value.length).toBeGreaterThan(0);
      expect(fact.en.label.length).toBeGreaterThan(0);
      expect(fact.en.value.length).toBeGreaterThan(0);
    }
  });

  it("uses unique ids", () => {
    const ids = PRESS_FACTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("press · kit assets", () => {
  it("has at least 5 entries with both FR + EN copy", () => {
    expect(PRESS_KIT_ASSETS.length).toBeGreaterThanOrEqual(5);
    for (const asset of PRESS_KIT_ASSETS) {
      expect(asset.fr.title.length).toBeGreaterThan(0);
      expect(asset.en.title.length).toBeGreaterThan(0);
    }
  });

  it("declares one of the supported kinds", () => {
    const valid = new Set(["logo", "wordmark", "photo", "brand-book", "boilerplate"]);
    for (const a of PRESS_KIT_ASSETS) expect(valid.has(a.kind)).toBe(true);
  });
});

describe("press · releases", () => {
  it("has at least 1 dated release with FR + EN copy", () => {
    expect(PRESS_RELEASES.length).toBeGreaterThanOrEqual(1);
    for (const r of PRESS_RELEASES) {
      // ISO date — `YYYY-MM-DD` minimum.
      expect(r.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.fr.title.length).toBeGreaterThan(0);
      expect(r.en.title.length).toBeGreaterThan(0);
      expect(r.fr.dek.length).toBeGreaterThan(0);
      expect(r.en.dek.length).toBeGreaterThan(0);
      expect(r.fr.body.length).toBeGreaterThan(0);
      expect(r.en.body.length).toBeGreaterThan(0);
    }
  });

  it("uses unique slugs lookup-able via getPressRelease", () => {
    const slugs = getAllPressReleaseSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(getPressRelease(slug)).toBeDefined();
    expect(getPressRelease("does-not-exist")).toBeUndefined();
  });

  it("declares an allowed tag", () => {
    const valid = new Set(["launch", "partnership", "study", "product", "milestone"]);
    for (const r of PRESS_RELEASES) expect(valid.has(r.tag)).toBe(true);
  });
});

describe("press · media coverage", () => {
  it("is an array (may be empty Phase 1 — anti-fabrication policy)", () => {
    expect(Array.isArray(PRESS_MEDIA_COVERAGE)).toBe(true);
  });

  it("uses absolute https URLs when populated", () => {
    for (const m of PRESS_MEDIA_COVERAGE) {
      expect(m.url.startsWith("https://")).toBe(true);
    }
  });
});

describe("press · spokespersons", () => {
  it("has at least 1 spokesperson with FR + EN copy, citable quote and LinkedIn URL", () => {
    expect(PRESS_SPOKESPERSONS.length).toBeGreaterThanOrEqual(1);
    for (const p of PRESS_SPOKESPERSONS) {
      expect(p.fr.name.length).toBeGreaterThan(0);
      expect(p.en.name.length).toBeGreaterThan(0);
      expect(p.fr.bio.length).toBeGreaterThan(40);
      expect(p.en.bio.length).toBeGreaterThan(40);
      // Citation attribuée prête à citer (manque presse comblé 2026-06-23).
      expect(p.fr.quote.length).toBeGreaterThan(40);
      expect(p.en.quote.length).toBeGreaterThan(40);
      expect(p.linkedinUrl.startsWith("https://www.linkedin.com/")).toBe(true);
      expect(p.languages.length).toBeGreaterThan(0);
      expect(p.knowsAbout.length).toBeGreaterThan(0);
    }
  });
});

describe("press · FAQ", () => {
  it("has 5 to 8 entries with FR + EN parity", () => {
    expect(PRESS_FAQ.length).toBeGreaterThanOrEqual(5);
    expect(PRESS_FAQ.length).toBeLessThanOrEqual(8);
    for (const f of PRESS_FAQ) {
      expect(f.fr.question.endsWith("?")).toBe(true);
      expect(f.en.question.endsWith("?")).toBe(true);
      expect(f.fr.answer.length).toBeGreaterThan(40);
      expect(f.en.answer.length).toBeGreaterThan(40);
    }
  });

  it("uses unique ids", () => {
    const ids = PRESS_FAQ.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
