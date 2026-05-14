/**
 * Sprint 1 Day 3 AGT-E — Tests des 6 modules quality content-gen.
 */

import { describe, expect, it } from "vitest";
import { shingles, jaccardSimilarity, checkPlagiarism } from "../plagiarism";
import { computeReadabilityFr } from "../readability";
import { computeSeoScore } from "../seo-score";
import { levenshteinSimilarity, topicFingerprint } from "../dedup-guard";
import { validateIntentAlignment } from "../search-intent-validator";

describe("Plagiarism — shingling + Jaccard", () => {
  it("shingles produces 5-grams", () => {
    const set = shingles("the quick brown fox jumps over the lazy dog");
    expect(set.size).toBeGreaterThan(0);
    expect(set.has("the quick brown fox jumps")).toBe(true);
  });

  it("jaccard identical texts = 1.0", () => {
    const t = "Axion-IA est un cabinet IA opérationnel français.";
    expect(jaccardSimilarity(t, t)).toBe(1);
  });

  it("jaccard fully different texts ≈ 0", () => {
    const sim = jaccardSimilarity(
      "Le chat de Marie joue avec la pelote rouge sur le tapis bleu",
      "Pour acheter une voiture neuve il faut budget plusieurs milliers euros",
    );
    expect(sim).toBe(0);
  });

  it("checkPlagiarism flags duplicate vs corpus", () => {
    const corpus = new Map([
      ["doc-1", "Axion-IA est un cabinet IA opérationnel français basé en Estonie."],
    ]);
    const result = checkPlagiarism(
      "Axion-IA est un cabinet IA opérationnel français basé en Estonie aujourd'hui.",
      corpus,
      0.3,
    );
    expect(result.maxSimilarity).toBeGreaterThan(0.3);
    expect(result.passed).toBe(false);
  });
});

describe("Readability Flesch-Kincaid FR", () => {
  it("simple text returns high score", () => {
    const r = computeReadabilityFr("Le chat dort. Le chien mange. Marie sourit.");
    expect(r.score).toBeGreaterThan(60);
    expect(r.wordCount).toBe(8);
    expect(r.sentenceCount).toBe(3);
  });

  it("dense technical text returns low score", () => {
    const r = computeReadabilityFr(
      "L'implémentation algorithmique des transformateurs nécessite une compréhension approfondie des mécanismes d'attention multi-tête conjointement aux représentations contextualisées asymétriquement structurées.",
    );
    expect(r.score).toBeLessThan(60);
  });
});

describe("SEO score — déterministe /100", () => {
  it("perfect article scores ≥ 80", () => {
    const goodHtml = `<h1>Audit IA pour cabinets comptables</h1>
      <h2>Pourquoi</h2><h2>Comment</h2><h2>Bénéfices</h2><h2>Ressources</h2>`;
    const result = computeSeoScore({
      title: "Audit IA pour cabinets comptables : 5 cas d'usage 2026",
      metaDescription:
        "Découvrez 5 cas d'audit IA validés pour les cabinets comptables : OCR, prédiction trésorerie, automatisation saisies. Plan d'attaque chiffré dès 490 € HT.",
      bodyHtml: goodHtml,
      bodyText:
        "audit IA cabinet comptable audit IA cabinet comptable audit IA cabinet comptable. " +
        "lorem ipsum ".repeat(500),
      directAnswer:
        "L'audit IA en cabinet comptable identifie en 5 jours les workflows à fort potentiel d'automatisation : saisie OCR, rapprochement bancaire, génération de fiches client, prédiction de trésorerie. AxionIA livre un plan d'attaque chiffré dès 490 € HT, avec ROI moyen documenté de 30 à 50 %.",
      faqCount: 6,
      internalLinkCount: 4,
      imageCount: 2,
      imagesWithAlt: 2,
      imagesWithCaption: 2,
      citationCount: 3,
      canonical: "https://axion-ia.com/blog/audit-ia-cabinets-comptables",
      hasPersonManonJsonLd: true,
      primaryKeyword: "audit ia cabinet comptable",
      contentKind: "article",
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("missing direct answer + no H1 scores lower", () => {
    const result = computeSeoScore({
      title: "Audit IA",
      metaDescription: "Court",
      bodyHtml: "<p>Just a paragraph</p>",
      bodyText: "Just a paragraph",
      contentKind: "article",
    });
    expect(result.score).toBeLessThan(40);
  });
});

describe("Dedup guard — Levenshtein + topic fingerprint", () => {
  it("levenshtein identical = 1", () => {
    expect(levenshteinSimilarity("Audit IA Lyon", "Audit IA Lyon")).toBe(1);
  });

  it("levenshtein very similar ≥ 0.85", () => {
    expect(levenshteinSimilarity("Audit IA Lyon 2026", "Audit IA Lyon 2025")).toBeGreaterThan(0.85);
  });

  it("levenshtein very different < 0.5", () => {
    expect(
      levenshteinSimilarity("Audit IA Lyon", "Le prix des camions Volvo en 2026"),
    ).toBeLessThan(0.5);
  });

  it("topic fingerprint stable for same keywords reordered", () => {
    const fp1 = topicFingerprint(["audit", "ia", "lyon", "pme", "comptable"]);
    const fp2 = topicFingerprint(["pme", "audit", "comptable", "lyon", "ia"]);
    expect(fp1).toBe(fp2);
  });

  it("topic fingerprint different for different keyword sets", () => {
    const fp1 = topicFingerprint(["audit", "ia"]);
    const fp2 = topicFingerprint(["implementation", "chatbot"]);
    expect(fp1).not.toBe(fp2);
  });
});

describe("Search intent validator — alignement structurel", () => {
  it("transactional sans CTA hardFails", () => {
    const r = validateIntentAlignment({
      intent: "transactional",
      slug: "audit-ia-paris",
      title: "Audit IA Paris dès 490 €",
      metaDescription: "...",
      bodyHtml: "<p>...</p>",
      hasPrimaryCta: false,
    });
    expect(r.aligned).toBe(false);
    expect(r.hardFails.length).toBeGreaterThan(0);
  });

  it("local sans LocalBusiness JSON-LD hardFails", () => {
    const r = validateIntentAlignment({
      intent: "local",
      slug: "cabinet-ia-lyon",
      title: "Cabinet IA Lyon",
      metaDescription: "...",
      bodyHtml: "<p>...</p>",
      hasLocalBusinessJsonLd: false,
      hasGeoMeta: false,
    });
    expect(r.aligned).toBe(false);
  });

  it("informational avec ≥ 3 citations aligné", () => {
    const r = validateIntentAlignment({
      intent: "informational",
      slug: "comment-auditer-ia-cabinet",
      title: "Comment auditer votre IA en cabinet ?",
      metaDescription: "...",
      bodyHtml: "<p>...</p>",
      citationCount: 3,
    });
    expect(r.aligned).toBe(true);
  });

  it("commercial_investigation avec <table> aligné", () => {
    const r = validateIntentAlignment({
      intent: "commercial_investigation",
      slug: "mistral-vs-claude-pme",
      title: "Mistral vs Claude pour PME : comparatif 2026",
      metaDescription: "...",
      bodyHtml: "<table>...</table>",
      hasComparisonTable: true,
    });
    expect(r.aligned).toBe(true);
  });
});
