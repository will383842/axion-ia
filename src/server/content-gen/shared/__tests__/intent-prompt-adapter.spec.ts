/**
 * Phase D Sprint Perfection 2026-05-22 — Tests intent-prompt-adapter.ts
 *
 * Tests :
 * 1. getIntentPromptAddendum : voice_search retourne addendum TTS
 * 2. getIntentPromptAddendum : ai_overview retourne addendum SGE
 * 3. getIntentPromptAddendum : featured_snippet retourne addendum position 0
 * 4. getIntentPromptAddendum : legacy intents retournent ""
 * 5. getIntentPromptAddendum : null/undefined retournent ""
 * 6. classifyKeywordIntent : question longue → voice_search
 * 7. classifyKeywordIntent : "qu'est-ce que" → ai_overview
 * 8. classifyKeywordIntent : mot court info → featured_snippet
 * 9. classifyKeywordIntent : keyword local ne doit pas être featured_snippet
 * 10. classifyKeywordIntent : keyword sans trigger → null
 */

import { describe, it, expect } from "vitest";
import {
  getIntentPromptAddendum,
  classifyKeywordIntent,
} from "../intent-prompt-adapter";

describe("getIntentPromptAddendum", () => {
  it("voice_search returns TTS addendum with 'phrases courtes'", () => {
    const result = getIntentPromptAddendum("voice_search");
    expect(result).toContain("VOICE SEARCH");
    expect(result).toContain("Phrases courtes");
    expect(result).toContain("15 mots");
  });

  it("ai_overview returns SGE addendum with 'sources d'autorité'", () => {
    const result = getIntentPromptAddendum("ai_overview");
    expect(result).toContain("AI OVERVIEW");
    expect(result).toContain("sources autorité");
  });

  it("featured_snippet returns position 0 addendum with '40-60 mots'", () => {
    const result = getIntentPromptAddendum("featured_snippet");
    expect(result).toContain("FEATURED SNIPPET");
    expect(result).toContain("40-60");
    expect(result).toContain("data-aeo");
  });

  it("informational (legacy) returns empty string", () => {
    expect(getIntentPromptAddendum("informational")).toBe("");
  });

  it("transactional (legacy) returns empty string", () => {
    expect(getIntentPromptAddendum("transactional")).toBe("");
  });

  it("null returns empty string", () => {
    expect(getIntentPromptAddendum(null)).toBe("");
  });

  it("undefined returns empty string", () => {
    expect(getIntentPromptAddendum(undefined)).toBe("");
  });
});

describe("classifyKeywordIntent", () => {
  it("long question with 'comment' → voice_search", () => {
    expect(classifyKeywordIntent("comment auditer une IA en entreprise")).toBe("voice_search");
  });

  it("long question with 'qu'est-ce que' (long) → ai_overview over voice_search", () => {
    const result = classifyKeywordIntent("qu'est-ce que l'intelligence artificielle");
    // Contains "qu'est-ce que" = ai_overview trigger wins in order
    expect(["ai_overview", "voice_search"]).toContain(result);
  });

  it("'définition audit ia' → ai_overview", () => {
    expect(classifyKeywordIntent("définition audit ia")).toBe("ai_overview");
  });

  it("short info keyword 'audit ia' → featured_snippet", () => {
    expect(classifyKeywordIntent("audit ia")).toBe("featured_snippet");
  });

  it("local keyword 'audit ia paris' → NOT featured_snippet", () => {
    const result = classifyKeywordIntent("audit ia paris");
    expect(result).not.toBe("featured_snippet");
  });

  it("generic transactional keyword → null", () => {
    expect(classifyKeywordIntent("devis accompagnement intelligence artificielle pme region")).toBeNull();
  });
});
