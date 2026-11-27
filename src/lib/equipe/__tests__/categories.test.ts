import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORIES_IDS, categoriesOrdonnees, estCategorie } from "..";

describe("registre des catégories", () => {
  it("couvre exactement les cinq catégories", () => {
    expect([...CATEGORIES_IDS].sort()).toEqual(
      ["apporteur", "developpeur", "direction", "partenaire", "specialiste-ia"].sort(),
    );
    expect(Object.keys(CATEGORIES).sort()).toEqual([...CATEGORIES_IDS].sort());
  });
  it("chaque entrée porte son propre id, un libellé, un jeton (jamais un hex)", () => {
    for (const [id, c] of Object.entries(CATEGORIES)) {
      expect(c.id).toBe(id);
      expect(c.libelleSingulier.length).toBeGreaterThan(0);
      expect(c.libellePluriel.length).toBeGreaterThan(0);
      expect(c.jetonCouleur).toMatch(/^[a-z-]+$/);
    }
  });
  it("jetons de couleur fixés, sans aucun bleu", () => {
    expect(
      Object.fromEntries(Object.values(CATEGORIES).map((c) => [c.id, c.jetonCouleur])),
    ).toEqual({
      direction: "terracotta",
      apporteur: "ochre",
      developpeur: "sage",
      "specialiste-ia": "plum",
      partenaire: "mocha",
    });
  });
  it("une forme distincte par catégorie (daltoniens)", () => {
    const formes = Object.values(CATEGORIES).map((c) => c.forme);
    expect(new Set(formes).size).toBe(formes.length);
  });
  it("ordre du hub unique, direction en premier", () => {
    const o = categoriesOrdonnees();
    expect(o[0]?.id).toBe("direction");
    expect(new Set(o.map((c) => c.ordreHub)).size).toBe(o.length);
  });
  it("estCategorie", () => {
    expect(estCategorie("apporteur")).toBe(true);
    expect(estCategorie("persona-ia")).toBe(false);
    expect(estCategorie(3)).toBe(false);
  });
});
