// P1-5 City Domination 2026-05-18 — Tests soft-404 word count gate.

import { describe, it, expect } from "vitest";
import {
  evaluateSoft404,
  SOFT_404_MIN_WORD_COUNT_DEFAULT,
  SOFT_404_MIN_WORD_COUNT_WITH_RICH_JSON_LD,
} from "../soft-404-gate";

describe("evaluateSoft404 — P1-5 anti-doorway HCU", () => {
  it("seuil par défaut = 350 mots", () => {
    expect(SOFT_404_MIN_WORD_COUNT_DEFAULT).toBe(350);
  });

  it("seuil rich (JSON-LD complet + cas local) = 280 mots", () => {
    expect(SOFT_404_MIN_WORD_COUNT_WITH_RICH_JSON_LD).toBe(280);
  });

  it("flag soft-404 si wordCount < 350 et pas de richesse JSON-LD", () => {
    const v = evaluateSoft404({
      wordCount: 300,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
    });
    expect(v.isSoft404).toBe(true);
    if (v.isSoft404) {
      expect(v.reason).toBe("below-default");
      expect(v.threshold).toBe(350);
    }
  });

  it("tolère 300 mots si JSON-LD complet + cas local (rich bonus 280 seuil)", () => {
    const v = evaluateSoft404({
      wordCount: 300,
      hasFullLocalBusinessJsonLd: true,
      hasLocalCase: true,
    });
    expect(v.isSoft404).toBe(false);
    if (!v.isSoft404) {
      expect(v.threshold).toBe(280);
    }
  });

  it("flag soft-404 si wordCount < 280 même avec rich JSON-LD (vraiment thin)", () => {
    const v = evaluateSoft404({
      wordCount: 250,
      hasFullLocalBusinessJsonLd: true,
      hasLocalCase: true,
    });
    expect(v.isSoft404).toBe(true);
    if (v.isSoft404) {
      expect(v.reason).toBe("below-rich-tolerance");
      expect(v.threshold).toBe(280);
    }
  });

  it("FAQ ≥ 4 questions ajoute +50 mots équivalents (bonus richesse)", () => {
    // 310 + 50 = 360 ≥ 350 → pass même sans rich JSON-LD
    const v = evaluateSoft404({
      wordCount: 310,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
      faqCount: 5,
    });
    expect(v.isSoft404).toBe(false);
  });

  it("FAQ < 4 questions = pas de bonus", () => {
    // 310 + 0 = 310 < 350 → soft-404
    const v = evaluateSoft404({
      wordCount: 310,
      hasFullLocalBusinessJsonLd: false,
      hasLocalCase: false,
      faqCount: 3,
    });
    expect(v.isSoft404).toBe(true);
  });

  it("page gold standard (5000 mots) passe trivialement", () => {
    const v = evaluateSoft404({
      wordCount: 5000,
      hasFullLocalBusinessJsonLd: true,
      hasLocalCase: true,
      faqCount: 8,
    });
    expect(v.isSoft404).toBe(false);
  });

  it("page squelette absolu (50 mots) flag même avec tout", () => {
    const v = evaluateSoft404({
      wordCount: 50,
      hasFullLocalBusinessJsonLd: true,
      hasLocalCase: true,
      faqCount: 10,
    });
    expect(v.isSoft404).toBe(true);
  });

  it("page T3 long-tail typique (380 mots) passe", () => {
    const v = evaluateSoft404({
      wordCount: 380,
      hasFullLocalBusinessJsonLd: true,
      hasLocalCase: false,
    });
    expect(v.isSoft404).toBe(false);
  });
});
