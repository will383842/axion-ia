/**
 * V-08 audit 2026-05-22 P0 — tests validation post-LLM 3 intents 2026
 * + sanity check intents legacy.
 *
 * Couvre voice_search / ai_overview / featured_snippet (best practices SEO 2026)
 * + transactional / local / informational / commercial_investigation / navigational.
 */
import { describe, it, expect } from "vitest";
import { validateIntentAlignment } from "./search-intent-validator";

const BASE = {
  slug: "test-slug",
  title: "Test Title",
  metaDescription: "Lorem ipsum.",
  bodyHtml: "<p>Body.</p>",
} as const;

describe("validateIntentAlignment — voice_search (V-08 P0 2026-05-22)", () => {
  it("aligned : phrases courtes + title conversationnel", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "voice_search",
      title: "Comment auditer son IA ?",
      bodyHtml: "<p>Réponse courte. Simple à comprendre. Trois phrases concises.</p>",
    });
    expect(result.aligned).toBe(true);
    expect(result.hardFails).toEqual([]);
  });

  it("hard fail : ≥ 30 % phrases > 15 mots (TTS-unfriendly)", () => {
    const longSentence =
      "Cette phrase est volontairement très longue pour dépasser les quinze mots maximum recommandés pour optimiser la recherche vocale TTS-friendly compatible avec assistants.";
    const result = validateIntentAlignment({
      ...BASE,
      intent: "voice_search",
      title: "Comment ?",
      bodyHtml: `<p>${longSentence} ${longSentence} ${longSentence} Court.</p>`,
    });
    expect(result.aligned).toBe(false);
    expect(result.hardFails[0]).toContain("voice_search");
  });

  it("warning : title non conversationnel", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "voice_search",
      title: "Titre déclaratif sans interrogation",
      bodyHtml: "<p>Phrase courte.</p>",
    });
    expect(result.aligned).toBe(true);
    expect(result.warnings.some((w) => w.includes("conversationnel"))).toBe(true);
  });
});

describe("validateIntentAlignment — ai_overview (V-08 P0 2026-05-22)", () => {
  it("aligned : metaDescription 30-60 mots + premier <p> 30-70 mots + 1 citation", () => {
    const meta = "Lorem ipsum dolor sit amet ".repeat(8).trim();
    const firstP = "Premier paragraphe ".repeat(20).trim();
    const result = validateIntentAlignment({
      ...BASE,
      intent: "ai_overview",
      metaDescription: meta,
      bodyHtml: `<p>${firstP}</p><p>Suite.</p>`,
      citationCount: 2,
    });
    expect(result.aligned).toBe(true);
    expect(result.hardFails).toEqual([]);
  });

  it("hard fail : premier <p> introuvable", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "ai_overview",
      bodyHtml: "<div>Pas de p</div>",
    });
    expect(result.aligned).toBe(false);
    expect(result.hardFails[0]).toContain("premier <p>");
  });

  it("warning : metaDescription trop courte", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "ai_overview",
      metaDescription: "Court.",
      bodyHtml: `<p>${"Mot ".repeat(40).trim()}</p>`,
      citationCount: 1,
    });
    expect(result.aligned).toBe(true);
    expect(result.warnings.some((w) => w.includes("metaDescription"))).toBe(true);
  });
});

describe("validateIntentAlignment — featured_snippet (V-08 P0 2026-05-22)", () => {
  it("aligned : bloc data-aeo=tldr 30-75 mots", () => {
    const tldr = "Mot ".repeat(50).trim();
    const result = validateIntentAlignment({
      ...BASE,
      intent: "featured_snippet",
      bodyHtml: `<p data-aeo="tldr">${tldr}</p><p>Suite.</p>`,
    });
    expect(result.aligned).toBe(true);
    expect(result.hardFails).toEqual([]);
  });

  it("hard fail : bloc data-aeo=tldr manquant", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "featured_snippet",
      bodyHtml: "<p>Pas de tldr.</p>",
    });
    expect(result.aligned).toBe(false);
    expect(result.hardFails[0]).toContain('data-aeo="tldr"');
  });

  it("warning : tldr hors de la plage 30-75 mots", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "featured_snippet",
      bodyHtml: `<p data-aeo="tldr">Trop court.</p>`,
    });
    expect(result.aligned).toBe(true);
    expect(result.warnings.some((w) => w.includes("TLDR"))).toBe(true);
  });
});

describe("validateIntentAlignment — intents legacy (sanity)", () => {
  it("transactional : hard fail si pas de CTA primary", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "transactional",
      slug: "reserver-audit",
      title: "Réservez votre audit",
      hasPrimaryCta: false,
    });
    expect(result.aligned).toBe(false);
  });

  it("local : hard fail si pas de LocalBusiness JSON-LD", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "local",
      hasLocalBusinessJsonLd: false,
      hasGeoMeta: true,
    });
    expect(result.aligned).toBe(false);
  });

  it("informational : hard fail si < 3 citations", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "informational",
      title: "Comment auditer",
      citationCount: 1,
    });
    expect(result.aligned).toBe(false);
  });

  it("commercial_investigation : hard fail sans <table>", () => {
    const result = validateIntentAlignment({
      ...BASE,
      intent: "commercial_investigation",
      title: "X vs Y comparatif",
      hasComparisonTable: false,
    });
    expect(result.aligned).toBe(false);
  });
});
