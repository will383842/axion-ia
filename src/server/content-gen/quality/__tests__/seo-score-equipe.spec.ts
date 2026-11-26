import { describe, expect, it } from "vitest";
import { computeSeoScore, type SeoScoreInput } from "../seo-score";

const mots = (n: number, d = "Une") =>
  `${d} ${Array.from({ length: n - 1 }, (_, i) => `m${i}`).join(" ")}`;

const ENTREE: SeoScoreInput = {
  title: "Audit IA pour PME : méthode complète et concrète",
  metaDescription: "audit ia ".padEnd(150, "x"),
  bodyHtml: `<p>Notre audit ia ${mots(45)}</p><h2>Audit ia en pratique</h2><p>${mots(50)}</p><p>${mots(60)}</p><h2>Etapes</h2><h2>Suite</h2>`,
  bodyText: "audit ia ".repeat(5) + mots(900),
  primaryKeyword: "audit ia",
  directAnswer: mots(50),
  faqCount: 4,
  internalLinkCount: 3,
  imageCount: 1,
  imagesWithAlt: 1,
  imagesWithCaption: 1,
  citationCount: 3,
  canonical: "https://axion-ia.com/fr/blog/x",
  hasPageH1: true,
  searchIntent: "informational",
  contentKind: "article",
};

const ON = { CONTENT_EQUIPE_EDITORIALE: "true" };

describe("computeSeoScore — interrupteur", () => {
  it("éteint : note identique à la grille historique (sans second paramètre ou env vide)", () => {
    const a = computeSeoScore({ ...ENTREE, hasPersonManonJsonLd: true }, {});
    const b = computeSeoScore(
      { ...ENTREE, hasPersonManonJsonLd: true },
      { CONTENT_EQUIPE_EDITORIALE: "yes" },
    );
    expect(a).toEqual(b);
    expect(a.breakdown.map((c) => c.criterion)).toContain("Person Manon JSON-LD");
    expect(a.breakdown.reduce((s, c) => s + c.max, 0)).toBe(100);
  });
});

describe("computeSeoScore — grille équipe éditoriale", () => {
  it("garde un total de 100 points", () => {
    const r = computeSeoScore(ENTREE, ON);
    expect(r.breakdown.reduce((s, c) => s + c.max, 0)).toBe(100);
  });
  it("note les passages citables : 3 → 4 pts, 0 → 0 pt", () => {
    const trois = computeSeoScore(
      { ...ENTREE, bodyHtml: `${ENTREE.bodyHtml}<p>${mots(55, "Trois")}</p>` },
      ON,
    );
    expect(trois.breakdown.find((c) => c.criterion.startsWith("Passages"))?.got).toBe(4);
    const zero = computeSeoScore({ ...ENTREE, bodyHtml: "<h2>audit ia</h2>" }, ON);
    expect(zero.breakdown.find((c) => c.criterion.startsWith("Passages"))?.got).toBe(0);
  });
  it("le mot-clé est cherché dans la méta-description, le premier paragraphe et un H2", () => {
    const plein = computeSeoScore({ ...ENTREE, title: "Audit IA pour PME" }, ON);
    expect(plein.breakdown.find((c) => c.criterion.startsWith("Primary"))?.got).toBe(12);
    const vide = computeSeoScore(
      {
        ...ENTREE,
        title: "Guide",
        metaDescription: "x".repeat(150),
        bodyHtml: "<p>Intro</p><h2>Etapes</h2>",
      },
      ON,
    );
    expect(vide.breakdown.find((c) => c.criterion.startsWith("Primary"))?.got).toBe(0);
  });
  it("l'auteur actuel satisfait le critère d'auteur ; éteint, il ne compte pas", () => {
    const on = computeSeoScore({ ...ENTREE, hasAuteurActuelJsonLd: true }, ON);
    expect(on.breakdown.find((c) => c.criterion.startsWith("Auteur"))?.got).toBe(3);
    const off = computeSeoScore({ ...ENTREE, hasAuteurActuelJsonLd: true }, {});
    expect(off.breakdown.find((c) => c.criterion.startsWith("Person"))?.got).toBe(0);
  });
  it("la FAQ compte dès 4 questions", () => {
    expect(computeSeoScore(ENTREE, ON).breakdown.find((c) => c.criterion === "FAQ 4+")?.got).toBe(
      8,
    );
  });
});
