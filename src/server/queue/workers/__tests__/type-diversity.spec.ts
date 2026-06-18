import { describe, it, expect } from "vitest";
import { buildWeightedSequence } from "@/server/content-gen/scheduler/type-sequence";

describe("buildWeightedSequence — diversité des types sur petit volume", () => {
  // Le mix réel d'une campagne Grenoble (somme = 100). L'ordre des clés imite
  // le réordonnancement JSONB Postgres qui plaçait faq_geo (poids 5) en tête.
  const MIX = {
    faq_geo: 5,
    what_is_x: 10,
    comparison: 10,
    blog_article: 20,
    guide_pilier: 15,
    how_to_x_in_y: 10,
    landing_ville: 15,
    pain_point_solution: 15,
  };

  it("ne produit PAS 5× le même type sur 6 slots (le bug d'origine)", () => {
    const seq = buildWeightedSequence(MIX, 6);
    expect(seq).toHaveLength(6);
    const distinct = new Set(seq).size;
    // Avant le fix : 5× faq_geo (1 seul type). Après : ≥4 types distincts sur 6.
    expect(distinct).toBeGreaterThanOrEqual(4);
  });

  it("le type le plus lourd domine sans monopoliser (proportionnalité)", () => {
    const seq = buildWeightedSequence(MIX, 100);
    const counts: Record<string, number> = {};
    for (const t of seq) counts[t] = (counts[t] ?? 0) + 1;
    // blog_article (20%) doit être le plus fréquent ~20 fois ; faq_geo (5%) ~5.
    expect(counts["blog_article"]).toBeGreaterThan(counts["faq_geo"]!);
    expect(counts["blog_article"]).toBeGreaterThanOrEqual(17);
    expect(counts["blog_article"]).toBeLessThanOrEqual(23);
    expect(counts["faq_geo"]).toBeGreaterThanOrEqual(3);
  });

  it("est déterministe (même entrée → même sortie) et indépendant de l'ordre des clés", () => {
    const a = buildWeightedSequence(MIX, 8);
    const reordered = {
      pain_point_solution: 15,
      faq_geo: 5,
      blog_article: 20,
      landing_ville: 15,
      what_is_x: 10,
      guide_pilier: 15,
      comparison: 10,
      how_to_x_in_y: 10,
    };
    const b = buildWeightedSequence(reordered, 8);
    expect(a).toEqual(b);
  });

  it("gère les cas limites (vide, count 0, poids nuls)", () => {
    expect(buildWeightedSequence({}, 5)).toEqual([]);
    expect(buildWeightedSequence(MIX, 0)).toEqual([]);
    expect(buildWeightedSequence({ a: 0, b: 0 }, 3)).toEqual([]);
    expect(buildWeightedSequence({ only: 100 }, 3)).toEqual(["only", "only", "only"]);
  });
});
