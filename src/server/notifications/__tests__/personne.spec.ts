import { describe, it, expect } from "vitest";
import {
  PERSONNE_NON_NOMMEE,
  lienConsole,
  prenomEtInitiale,
  prenomEtInitialeDepuisNomComplet,
} from "../personne";

describe("prenomEtInitiale", () => {
  it("prénom + initiale du nom", () => {
    expect(prenomEtInitiale("Marie", "Dupont")).toBe("Marie D.");
  });

  it("nom vide → le prénom seul ; prénom vide → l'initiale seule", () => {
    expect(prenomEtInitiale("Marie", "")).toBe("Marie");
    expect(prenomEtInitiale("Marie", null)).toBe("Marie");
    expect(prenomEtInitiale("", "Dupont")).toBe("D.");
  });

  it("les deux vides → repère neutre", () => {
    expect(prenomEtInitiale("", "  ")).toBe(PERSONNE_NON_NOMMEE);
    expect(prenomEtInitiale(undefined, undefined)).toBe(PERSONNE_NON_NOMMEE);
  });

  it("noms composés : première lettre du nom", () => {
    expect(prenomEtInitiale("Jean-Pierre", "Martin-Durand")).toBe("Jean-Pierre M.");
    expect(prenomEtInitiale("Ana", "García López")).toBe("Ana G.");
  });

  it("particules et élisions ignorées", () => {
    expect(prenomEtInitiale("Jean", "de la Fontaine")).toBe("Jean F.");
    expect(prenomEtInitiale("Ludwig", "van Beethoven")).toBe("Ludwig B.");
    expect(prenomEtInitiale("Jean", "d'Alembert")).toBe("Jean A.");
    expect(prenomEtInitiale("Anne", "d’Arc")).toBe("Anne A.");
    expect(prenomEtInitiale("Paul", "Le")).toBe("Paul L.");
  });

  it("casse uniforme normalisée, casse mixte respectée", () => {
    expect(prenomEtInitiale("MARIE", "DUPONT")).toBe("Marie D.");
    expect(prenomEtInitiale("marie-ève", "élie")).toBe("Marie-Ève É.");
    expect(prenomEtInitiale("McKenzie", "dupont")).toBe("McKenzie D.");
  });

  it("n'écrit jamais plus que la première lettre du nom", () => {
    const rendu = prenomEtInitiale("Marie", "Dupontcanari");
    expect(rendu).not.toContain("upont");
  });

  it("écarte un mot qui porte une arobase ou un chiffre", () => {
    expect(prenomEtInitiale("marie@exemple.fr", "Dupont")).toBe("D.");
    expect(prenomEtInitiale("Marie", "0612345678")).toBe("Marie");
  });
});

describe("prenomEtInitialeDepuisNomComplet", () => {
  it("premier mot = prénom, le reste = nom", () => {
    expect(prenomEtInitialeDepuisNomComplet("Marie Dupont")).toBe("Marie D.");
    expect(prenomEtInitialeDepuisNomComplet("  Jean   de la Fontaine ")).toBe("Jean F.");
    expect(prenomEtInitialeDepuisNomComplet("Léa")).toBe("Léa");
  });

  it("idempotent sur un rendu déjà réduit", () => {
    expect(prenomEtInitialeDepuisNomComplet("Marie D.")).toBe("Marie D.");
  });

  it("repères et valeurs vides → repère neutre", () => {
    expect(prenomEtInitialeDepuisNomComplet("(non communiqué)")).toBe(PERSONNE_NON_NOMMEE);
    expect(prenomEtInitialeDepuisNomComplet("—")).toBe(PERSONNE_NON_NOMMEE);
    expect(prenomEtInitialeDepuisNomComplet("")).toBe(PERSONNE_NON_NOMMEE);
    expect(prenomEtInitialeDepuisNomComplet(null)).toBe(PERSONNE_NON_NOMMEE);
  });
});

describe("lienConsole", () => {
  it("pointe sous /fr/<préfixe admin>/", () => {
    expect(lienConsole("contacts/messages/abc")).toMatch(/\/fr\/[^/]+\/contacts\/messages\/abc$/);
    expect(lienConsole("/newsletter")).toMatch(/\/fr\/[^/]+\/newsletter$/);
  });
});
