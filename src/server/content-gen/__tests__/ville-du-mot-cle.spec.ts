/**
 * Ville nommée dans un mot-clé (audit blog/RAG du 24/10/2026) : un mot-clé qui
 * vise Strasbourg ne doit pas être donné à un job ancré sur Bezons.
 */

import { describe, expect, it } from "vitest";
import { motCleVisUneAutreVille, villesNommeesDansTexte } from "../ville-du-mot-cle";

describe("villesNommeesDansTexte", () => {
  it("trouve une grande ville écrite en minuscules", () => {
    expect(villesNommeesDansTexte("coaching ia strasbourg executive manager")).toEqual([
      "strasbourg",
    ]);
  });

  it("trouve une commune avec majuscule", () => {
    expect(villesNommeesDansTexte("formation IA Bezons")).toEqual(["bezons"]);
  });

  it("ignore les noms de communes qui sont des mots courants en minuscules", () => {
    expect(villesNommeesDansTexte("audit IA en ligne pour changer de méthode")).toEqual([]);
    expect(villesNommeesDansTexte("donner du sens à l'IA")).toEqual([]);
  });

  it("ne garde que le nom le plus long", () => {
    const noms = villesNommeesDansTexte("formation IA Saint-Etienne-du-Rouvray");
    expect(noms).not.toContain("saint etienne");
  });

  it("rend une liste vide pour un texte vide", () => {
    expect(villesNommeesDansTexte("")).toEqual([]);
  });
});

describe("motCleVisUneAutreVille", () => {
  it("vrai : mot-clé Strasbourg, job Bezons (le défaut observé)", () => {
    expect(motCleVisUneAutreVille("formation IA Strasbourg Grand Est", "Bezons")).toBe(true);
  });

  it("faux : mot-clé de la ville du job", () => {
    expect(motCleVisUneAutreVille("formation IA Strasbourg Grand Est", "Strasbourg")).toBe(false);
  });

  it("faux : mot-clé sans ville", () => {
    expect(motCleVisUneAutreVille("audit IA pour TPE", "Bezons")).toBe(false);
  });

  it("insensible aux accents et tirets du nom de la ville du job", () => {
    expect(motCleVisUneAutreVille("formation IA Saint-Denis", "Saint Denis")).toBe(false);
  });
});
