/**
 * Sprint v7 Phase 11 — Tests Speakable universel.
 */

import { describe, it, expect } from "vitest";
import {
  buildSpeakableSpecification,
  injectSpeakableInto,
  withUniversalSpeakable,
  DEFAULT_SPEAKABLE_SELECTORS,
} from "../speakable-universal";

describe("Phase 11 Speakable universel", () => {
  it("S1: buildSpeakableSpecification retourne SpeakableSpecification avec defaults", () => {
    const spec = buildSpeakableSpecification();
    expect(spec["@type"]).toBe("SpeakableSpecification");
    expect(spec.cssSelector).toEqual(DEFAULT_SPEAKABLE_SELECTORS);
    expect(spec.xpath).toBeUndefined();
  });

  it("S2: buildSpeakableSpecification accepte selectors custom", () => {
    const spec = buildSpeakableSpecification({ selectors: [".my-section"] });
    expect(spec.cssSelector).toEqual([".my-section"]);
  });

  it("S3: buildSpeakableSpecification accepte xpath", () => {
    const spec = buildSpeakableSpecification({
      selectors: ["h1"],
      xpath: ["//article/p[1]"],
    });
    expect(spec.xpath).toEqual(["//article/p[1]"]);
  });

  it("S4: injectSpeakableInto ajoute speakable au schema", () => {
    const schema = { "@type": "WebPage", name: "Test" };
    const enriched = injectSpeakableInto(schema);
    expect(enriched.speakable).toBeDefined();
    expect(enriched.speakable["@type"]).toBe("SpeakableSpecification");
    // Préserve les autres props
    expect(enriched["@type"]).toBe("WebPage");
    expect(enriched.name).toBe("Test");
  });

  it("S5: injectSpeakableInto idempotent (n'écrase pas si déjà présent)", () => {
    const existing = buildSpeakableSpecification({ selectors: [".existing"] });
    const schema = { "@type": "WebPage", speakable: existing };
    const enriched = injectSpeakableInto(schema);
    expect(enriched.speakable).toBe(existing); // identité d'objet
    expect(enriched.speakable.cssSelector).toEqual([".existing"]);
  });

  it("S6: withUniversalSpeakable retourne schema tel-quel si selectors vide (no-op)", () => {
    const schema = { "@type": "WebPage", name: "X" };
    const result = withUniversalSpeakable(schema, []);
    expect(result).toBe(schema); // identité d'objet, pas de wrap
  });

  it("S7: withUniversalSpeakable applique injectSpeakable si selectors non-vide", () => {
    const schema = { "@type": "Article", headline: "Y" };
    const result = withUniversalSpeakable(schema);
    expect("speakable" in result).toBe(true);
  });

  it("S8: DEFAULT_SPEAKABLE_SELECTORS inclut h1 + itemprop text + speakable class", () => {
    expect(DEFAULT_SPEAKABLE_SELECTORS).toContain("h1");
    expect(DEFAULT_SPEAKABLE_SELECTORS).toContain('[itemprop="text"]');
    expect(DEFAULT_SPEAKABLE_SELECTORS).toContain(".speakable");
  });
});
