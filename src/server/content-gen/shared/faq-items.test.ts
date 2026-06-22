import { describe, it, expect } from "vitest";
import { parseFaqItems } from "./faq-items";

describe("parseFaqItems", () => {
  it("parse un tableau {question, answer}", () => {
    const out = parseFaqItems([{ question: "Q1 ?", answer: "R1." }]);
    expect(out).toEqual([{ question: "Q1 ?", answer: "R1." }]);
  });

  it("normalise la forme courte {q, a}", () => {
    const out = parseFaqItems([{ q: "Q2 ?", a: "R2." }]);
    expect(out).toEqual([{ question: "Q2 ?", answer: "R2." }]);
  });

  it("ignore les items incomplets ou vides", () => {
    const out = parseFaqItems([
      { question: "ok ?", answer: "oui." },
      { question: "sans reponse ?" },
      { question: "   ", answer: "   " },
      null,
      "pas un objet",
    ]);
    expect(out).toEqual([{ question: "ok ?", answer: "oui." }]);
  });

  it("DÉBALLE un objet enveloppant {outline, faq:[...]} (bug /guides, guide-pilier)", () => {
    // guide-pilier.ts persiste faqJson comme objet, pas comme tableau plat.
    const guidePilierShape = {
      outline: { sections: [] },
      sectionFailures: [],
      faq: [
        { q: "Combien de temps ?", a: "Environ 2 heures." },
        { question: "Pour qui ?", answer: "Les dirigeants de TPE/PME." },
      ],
    };
    const out = parseFaqItems(guidePilierShape);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ question: "Combien de temps ?", answer: "Environ 2 heures." });
    expect(out[1]).toEqual({ question: "Pour qui ?", answer: "Les dirigeants de TPE/PME." });
  });

  it("retourne [] pour un objet sans clé faq", () => {
    expect(parseFaqItems({ outline: {}, sectionFailures: [] })).toEqual([]);
  });

  it("retourne [] pour null / undefined / non-objet", () => {
    expect(parseFaqItems(null)).toEqual([]);
    expect(parseFaqItems(undefined)).toEqual([]);
    expect(parseFaqItems("texte")).toEqual([]);
    expect(parseFaqItems(42)).toEqual([]);
  });
});
