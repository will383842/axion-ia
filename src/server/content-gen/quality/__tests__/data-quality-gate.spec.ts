import { describe, it, expect } from "vitest";
import { validateDataQuality } from "../data-quality-gate";
import { validateFaqItem, parseFaqItems } from "@/server/content-gen/shared/faq-items";

// Helpers de fabrication
const words = (n: number) => Array.from({ length: n }, (_, i) => `mot${i}`).join(" ");
const faq = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    question: `Question numéro ${i} suffisamment longue ?`,
    answer: `Réponse numéro ${i} suffisamment longue pour franchir le seuil de soixante caractères minimum.`,
  }));

const completeBlog = {
  contentType: "blog",
  keyTakeaway: words(8),
  expertQuote: { name: "Manon", text: words(20) },
  faqJson: faq(4),
  directAnswer: words(45),
  citationCount: 2,
};

describe("validateDataQuality", () => {
  it("accepte un article blog complet", () => {
    expect(validateDataQuality(completeBlog).ok).toBe(true);
  });

  it("rejette un directAnswer trop court (tous types)", () => {
    const r = validateDataQuality({ ...completeBlog, directAnswer: words(10) });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/directAnswer/);
  });

  it("rejette une FAQ < 4 items valides", () => {
    const r = validateDataQuality({ ...completeBlog, faqJson: faq(3) });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/FAQ/);
  });

  it("rejette < 2 citations", () => {
    const r = validateDataQuality({ ...completeBlog, citationCount: 1 });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/citations/);
  });

  it("rejette un blog sans point clé ni avis expert", () => {
    const r = validateDataQuality({ ...completeBlog, keyTakeaway: null, expertQuote: null });
    expect(r.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/point clé/);
    expect(r.reasons.join(" ")).toMatch(/expert/);
  });

  it("n'exige PAS point clé/expert pour la veille (blog_from_rss)", () => {
    const r = validateDataQuality({
      contentType: "blog_from_rss",
      keyTakeaway: null,
      expertQuote: null,
      faqJson: faq(4),
      directAnswer: words(45),
      citationCount: 2,
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateFaqItem", () => {
  it("accepte une Q/R substantielle", () => {
    expect(validateFaqItem("Une question assez longue ici ?", words(20)).ok).toBe(true);
  });
  it("rejette une question trop courte", () => {
    expect(validateFaqItem("Trop court ?", words(20)).ok).toBe(false);
  });
  it("rejette une réponse trop courte", () => {
    expect(validateFaqItem("Une question assez longue ici ?", "Oui.").ok).toBe(false);
  });
  it("rejette un placeholder", () => {
    expect(
      validateFaqItem("Une question assez longue ici ?", "TODO à remplir plus tard absolument").ok,
    ).toBe(false);
  });
});

describe("parseFaqItems strict", () => {
  it("dédoublonne les réponses identiques en mode strict", () => {
    const dup = [
      { question: "Première question suffisamment longue ?", answer: words(20) },
      { question: "Deuxième question suffisamment longue ?", answer: words(20) },
    ];
    expect(parseFaqItems(dup, { strict: true }).length).toBe(1);
  });
  it("reste lenient par défaut (rendu) — n'écarte pas les réponses courtes", () => {
    const short = [{ question: "Q ?", answer: "Oui." }];
    expect(parseFaqItems(short).length).toBe(1);
    expect(parseFaqItems(short, { strict: true }).length).toBe(0);
  });
});
