import { describe, expect, it } from "vitest";

import { composerVueEnsemble, variation } from "../vue";

describe("variation", () => {
  it("donne le pourcentage d'évolution", () => {
    expect(variation(118, 100)).toBeCloseTo(18);
    expect(variation(50, 100)).toBeCloseTo(-50);
  });
  it("renvoie null, jamais 0, quand la période d'avant est vide ou inconnue", () => {
    expect(variation(10, 0)).toBeNull();
    expect(variation(10, null)).toBeNull();
    expect(variation(null, 10)).toBeNull();
    expect(variation(Number.NaN, 10)).toBeNull();
  });
});

describe("composerVueEnsemble", () => {
  const courant = [
    { typePage: "article", clics: 12, impressions: 400, positionSum: 400 * 8 },
    { typePage: "ville", clics: 0, impressions: 0, positionSum: 0 },
  ];
  const precedent = [{ typePage: "article", clics: 10, impressions: 500, positionSum: 500 * 10 }];

  it("calcule clics, impressions, position, part de clics et évolutions par type", () => {
    const [article] = composerVueEnsemble(courant, precedent);
    expect(article?.typePage).toBe("article");
    expect(article?.clics).toBe(12);
    expect(article?.position).toBeCloseTo(8);
    expect(article?.ctr).toBeCloseTo(0.03);
    expect(article?.variationClics).toBeCloseTo(20);
    expect(article?.variationImpressions).toBeCloseTo(-20);
  });

  it("position et part de clics sont null sans impression (jamais 0)", () => {
    const ville = composerVueEnsemble(courant, precedent).find((l) => l.typePage === "ville");
    expect(ville?.position).toBeNull();
    expect(ville?.ctr).toBeNull();
    expect(ville?.variationClics).toBeNull();
  });

  it("ajoute un total et range les types sans type connu sous « autre »", () => {
    const lignes = composerVueEnsemble(
      [
        { typePage: null, clics: 1, impressions: 10, positionSum: 50 },
        { typePage: "autre", clics: 2, impressions: 10, positionSum: 30 },
      ],
      [],
    );
    expect(lignes.filter((l) => l.typePage === "autre")).toHaveLength(1);
    expect(lignes.find((l) => l.typePage === "autre")?.clics).toBe(3);
    const total = lignes.find((l) => l.typePage === "total");
    expect(total?.impressions).toBe(20);
    expect(total?.position).toBeCloseTo(4);
  });

  it("sans aucune donnée : liste vide, pas de total inventé", () => {
    expect(composerVueEnsemble([], [])).toEqual([]);
  });
});
