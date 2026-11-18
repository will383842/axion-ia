import { describe, expect, it } from "vitest";
import { normaliserSaisieVille, resoudreVille } from "../villes";

describe("villes : la clé de comptage", () => {
  it("ramène « Saint-Étienne » à sa clé et garde le nom du référentiel", () => {
    const v = resoudreVille("Saint-Étienne");
    expect(v?.cle).toBe("saint-etienne");
    expect(v?.nom).toBe("Saint-Étienne");
  });

  it("reconnaît « st etienne » (abréviation développée)", () => {
    expect(resoudreVille("st etienne")?.cle).toBe("saint-etienne");
  });

  it("ignore la casse, le code postal et « cedex »", () => {
    expect(resoudreVille("LYON")?.cle).toBe("lyon");
    expect(resoudreVille("lyon 69003")?.cle).toBe("lyon");
    expect(resoudreVille("Lyon cedex")?.nom).toBe("Lyon");
  });

  it("ne confond pas Saint-Étienne et Saint-Étienne-du-Rouvray", () => {
    expect(resoudreVille("Saint-Étienne-du-Rouvray")?.cle).toBe("saint-etienne-du-rouvray");
  });

  it("une ville ambiguë (Saint-Denis) n'a pas de nom : elle ne s'affichera jamais", () => {
    const v = resoudreVille("Saint-Denis");
    // Hors référentiel ou ambiguë : la clé garde le texte normalisé (mots séparés par une espace).
    expect(v?.cle).toBe("?saint denis");
    expect(v?.nom).toBeNull();
  });

  it("une ville hors référentiel compte, sans nom", () => {
    const v = resoudreVille("Villefontaine-les-Bains");
    expect(v?.cle.startsWith("?")).toBe(true);
    expect(v?.nom).toBeNull();
  });

  it("une ville vide est refusée", () => {
    expect(resoudreVille("")).toBeNull();
    expect(resoudreVille("   ")).toBeNull();
    expect(resoudreVille("69003")).toBeNull();
  });

  it("la clé ne dépasse jamais 100 caractères", () => {
    expect(resoudreVille("x".repeat(500))?.cle.length).toBeLessThanOrEqual(100);
  });

  it("normaliserSaisieVille : mots séparés par un espace, sans accent", () => {
    expect(normaliserSaisieVille("  Saint   Étienne ")).toBe("saint etienne");
  });
});
