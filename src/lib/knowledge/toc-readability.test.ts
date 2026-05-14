/**
 * KB V4 (Sprint KB-16) — Tests TOC + readability.
 */

import { describe, expect, it } from "vitest";
import { generateToc, injectHeadingIds } from "./toc-generator";
import { computeReadability } from "./readability";

describe("generateToc", () => {
  it("extrait H2 et H3", () => {
    const toc = generateToc("<h2>Intro</h2><p>x</p><h3>Sous</h3><h2>Suite</h2>");
    expect(toc).toHaveLength(3);
    expect(toc[0]).toEqual({ level: 2, id: "intro", title: "Intro" });
    expect(toc[1]).toEqual({ level: 3, id: "sous", title: "Sous" });
  });

  it("ignore H1 et H4", () => {
    const toc = generateToc("<h1>Titre</h1><h4>Skip</h4><h2>Visible</h2>");
    expect(toc).toHaveLength(1);
    expect(toc[0]!.title).toBe("Visible");
  });

  it("retourne vide si aucun heading", () => {
    expect(generateToc("<p>Pas de titre.</p>")).toEqual([]);
  });

  it("slugify accents", () => {
    const toc = generateToc("<h2>Démarrage rapide</h2>");
    expect(toc[0]!.id).toBe("demarrage-rapide");
  });

  it("ignore heading vide", () => {
    expect(generateToc("<h2></h2><h2>Vrai</h2>")).toHaveLength(1);
  });
});

describe("injectHeadingIds", () => {
  it("injecte id sur h2/h3 sans id existant", () => {
    const html = injectHeadingIds("<h2>Intro</h2><h3>Sous-section</h3>");
    expect(html).toContain('<h2 id="intro">');
    expect(html).toContain('<h3 id="sous-section">');
  });

  it("préserve id existant", () => {
    const html = injectHeadingIds('<h2 id="custom">Titre</h2>');
    expect(html).toContain('<h2 id="custom">');
    expect((html.match(/id=/g) ?? []).length).toBe(1);
  });
});

describe("computeReadability", () => {
  it("retourne null si texte trop court", () => {
    expect(computeReadability("Court.")).toBeNull();
  });

  it("calcule un score plausible pour texte standard", () => {
    const text = Array(15)
      .fill(
        "Ce projet aide les équipes à mieux travailler avec l'intelligence artificielle générative en 2026.",
      )
      .join(" ");
    const r = computeReadability(text);
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThan(0);
    expect(r!.score).toBeLessThanOrEqual(100);
    expect(r!.wordCount).toBeGreaterThan(30);
  });

  it("texte simple → grade easy ou standard", () => {
    const simple = Array(20).fill("Il fait beau. Le ciel est bleu. Nous allons au parc.").join(" ");
    const r = computeReadability(simple);
    expect(r).not.toBeNull();
    expect(["very_easy", "easy", "standard"]).toContain(r!.grade);
  });

  it("compte mots et phrases", () => {
    const text = Array(8)
      .fill("Phrase une de longueur moyenne. Phrase deux ici. Phrase trois plus courte.")
      .join(" ");
    const r = computeReadability(text);
    expect(r).not.toBeNull();
    expect(r!.wordCount).toBeGreaterThan(30);
    expect(r!.sentenceCount).toBeGreaterThan(1);
  });
});
