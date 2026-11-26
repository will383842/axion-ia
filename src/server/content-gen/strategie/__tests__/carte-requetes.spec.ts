import { describe, expect, it } from "vitest";
import {
  construireCarte,
  normaliserRequete,
  normaliserUrl,
  type EntreeCarte,
} from "../carte-requetes";

const A = "https://axion-ia.com/fr/blog/formation-ia";
const B = "https://axion-ia.com/fr/blog/formation-ia-entreprise";

describe("normaliserRequete", () => {
  it("passe en minuscules, retire accents et ponctuation", () => {
    expect(normaliserRequete("  Formation IA, à Lyon !  ")).toBe(
      normaliserRequete("formation ia lyon"),
    );
  });
  it("retire les mots vides français et l'apostrophe", () => {
    expect(normaliserRequete("Les outils de l'IA pour la PME")).toBe("ia outil pme");
  });
  it("ramène le pluriel simple au singulier", () => {
    expect(normaliserRequete("formations")).toBe(normaliserRequete("formation"));
    expect(normaliserRequete("tableaux")).toBe(normaliserRequete("tableau"));
  });
  it("ne tient pas compte de l'ordre des mots", () => {
    expect(normaliserRequete("ia formation")).toBe(normaliserRequete("formation ia"));
  });
  it("rend une chaîne vide pour une requête sans contenu", () => {
    expect(normaliserRequete("de la, le !")).toBe("");
  });
});

describe("normaliserUrl", () => {
  it("retire requête, ancre et barre finale", () => {
    expect(normaliserUrl("HTTPS://Axion-IA.com/fr/blog/x/?a=1#b")).toBe(
      "https://axion-ia.com/fr/blog/x",
    );
  });
});

describe("construireCarte", () => {
  it("carte vide : tout est libre, aucune cannibalisation", () => {
    const c = construireCarte([]);
    expect(c.carte.size).toBe(0);
    expect(c.cannibalisations).toEqual([]);
    expect(c.estLibre("formation ia")).toBe(true);
    expect(c.proprietaire("formation ia")).toBeNull();
  });

  it("associe une requête à son unique URL, quelle que soit la graphie", () => {
    const c = construireCarte([{ requete: "Formation IA", url: A, source: "suivi" }]);
    expect(c.proprietaire("formations ia")).toBe(A);
    expect(c.estLibre("formations IA")).toBe(false);
    expect(c.estLibre("autre sujet")).toBe(true);
  });

  it("détecte la cannibalisation : deux URL pour une requête", () => {
    const entrees: EntreeCarte[] = [
      { requete: "formation ia", url: A, source: "suivi", position: 8, impressions: 100 },
      { requete: "Formation  IA", url: B, source: "suivi", position: 3, impressions: 50 },
      { requete: "autre", url: B, source: "suivi" },
    ];
    const c = construireCarte(entrees);
    expect(c.cannibalisations).toHaveLength(1);
    expect(c.cannibalisations[0]!.urls).toEqual([A, B].sort());
    expect(c.cannibalisations[0]!.proprietaire).toBe(B);
    expect(c.proprietaire("formation ia")).toBe(B);
  });

  it("le plan éditorial l'emporte sur la mesure", () => {
    const c = construireCarte([
      { requete: "formation ia", url: A, source: "plan" },
      { requete: "formation ia", url: B, source: "suivi", position: 1, impressions: 999 },
    ]);
    expect(c.proprietaire("formation ia")).toBe(A);
  });

  it("deux entrées pour la même URL ne sont pas une cannibalisation", () => {
    const c = construireCarte([
      { requete: "formation ia", url: A, source: "suivi" },
      { requete: "formations IA", url: `${A}/`, source: "plan" },
    ]);
    expect(c.cannibalisations).toEqual([]);
  });

  it("ignore les entrées sans requête ou sans URL exploitable", () => {
    const c = construireCarte([
      { requete: "de la", url: A, source: "suivi" },
      { requete: "ia", url: "", source: "suivi" },
    ]);
    expect(c.carte.size).toBe(0);
  });
});
