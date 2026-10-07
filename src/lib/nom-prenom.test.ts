import { describe, it, expect } from "vitest";
import { splitNomPrenom } from "./nom-prenom";

describe("splitNomPrenom", () => {
  it("sépare « Prénom Nom » en deux colonnes", () => {
    expect(splitNomPrenom("Marie Dupont")).toEqual({ prenom: "Marie", nom: "Dupont" });
  });

  it("garde les noms composés entiers après le prénom", () => {
    expect(splitNomPrenom("Jean-Luc de La Fontaine")).toEqual({
      prenom: "Jean-Luc",
      nom: "de La Fontaine",
    });
  });

  it("traite un mot unique comme un nom sans prénom", () => {
    expect(splitNomPrenom("Dupont")).toEqual({ prenom: null, nom: "Dupont" });
  });

  it("normalise les espaces multiples et bords", () => {
    expect(splitNomPrenom("  Marie   Dupont  ")).toEqual({ prenom: "Marie", nom: "Dupont" });
  });

  it("rend null/vide comme deux colonnes vides", () => {
    expect(splitNomPrenom(null)).toEqual({ prenom: null, nom: null });
    expect(splitNomPrenom("   ")).toEqual({ prenom: null, nom: null });
  });
});

describe("splitNomPrenom — fiche du tunnel vidéo", () => {
  it("un seul mot + fiche vidéo : c'est un PRÉNOM, pas un nom", () => {
    expect(splitNomPrenom("Nadia", true)).toEqual({
      prenom: "Nadia",
      nom: null,
    });
  });

  it("sans fiche vidéo (ancien formulaire, dossier), rien ne change", () => {
    expect(splitNomPrenom("Nadia", false)).toEqual({
      prenom: null,
      nom: "Nadia",
    });
    expect(splitNomPrenom("Nadia")).toEqual({ prenom: null, nom: "Nadia" });
    expect(splitNomPrenom("Marie Dupont", false)).toEqual({ prenom: "Marie", nom: "Dupont" });
  });
});
