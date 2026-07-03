import { describe, it, expect } from "vitest";
import { normalizeFonction, normalizeQualite } from "./qualite-to-fonction";

describe("normalizeQualite", () => {
  it("minuscule, sans accents, espaces normalisés", () => {
    expect(normalizeQualite("Gérant  Associé")).toBe("gerant associe");
    expect(normalizeQualite(null)).toBe("");
  });
});

describe("normalizeFonction — dirigeants légaux", () => {
  it("Gérant", () => {
    expect(normalizeFonction("Gérant")).toMatchObject({
      fonctionNormalisee: "gerant",
      seniorite: "dirigeant",
      departementFonctionnel: "direction",
    });
  });
  it("Président Directeur Général (PDG)", () => {
    expect(normalizeFonction("Président Directeur Général")).toMatchObject({
      fonctionNormalisee: "directeur_general",
      seniorite: "dirigeant",
    });
    expect(normalizeFonction("PDG").fonctionNormalisee).toBe("directeur_general");
  });
  it("Directeur Général", () => {
    expect(normalizeFonction("Directeur Général").fonctionNormalisee).toBe("directeur_general");
  });
  it("Associé", () => {
    expect(normalizeFonction("Associé").fonctionNormalisee).toBe("associe");
  });
});

describe("normalizeFonction — directions fonctionnelles", () => {
  it("DAF", () => {
    expect(normalizeFonction("DAF")).toMatchObject({
      fonctionNormalisee: "directeur_administratif_financier",
      departementFonctionnel: "finance",
    });
  });
  it("DSI", () => {
    expect(normalizeFonction("Directeur des Systèmes d'Information")).toMatchObject({
      fonctionNormalisee: "directeur_des_systemes_information",
      departementFonctionnel: "dsi",
    });
  });
  it("Directeur commercial", () => {
    expect(normalizeFonction("Directrice commerciale")).toMatchObject({
      fonctionNormalisee: "directeur_commercial",
      departementFonctionnel: "commercial",
    });
  });
});

describe("normalizeFonction — responsables (passe B)", () => {
  it("Responsable des achats", () => {
    expect(normalizeFonction("Responsable des achats")).toMatchObject({
      fonctionNormalisee: "responsable_achats",
      seniorite: "responsable",
      departementFonctionnel: "achats",
    });
  });
  it("Responsable QHSE", () => {
    expect(normalizeFonction("Responsable QHSE")).toMatchObject({
      fonctionNormalisee: "responsable_qhse",
      departementFonctionnel: "qhse",
    });
  });
  it("Chef de chantier → technique", () => {
    expect(normalizeFonction("Chef de chantier")).toMatchObject({
      fonctionNormalisee: "responsable_technique",
      departementFonctionnel: "technique",
    });
  });
  it("Responsable générique conserve la séniorité même sans fonction précise", () => {
    expect(normalizeFonction("Responsable régional")).toMatchObject({
      seniorite: "responsable",
    });
  });
});

describe("normalizeFonction — repli", () => {
  it("titre inconnu → autre (jamais perdu)", () => {
    expect(normalizeFonction("Stagiaire")).toEqual({
      fonctionNormalisee: "autre",
      seniorite: "autre",
      departementFonctionnel: "autre",
    });
  });
  it("un titre 'cadre' explicite est capté", () => {
    expect(normalizeFonction("Cadre technique").seniorite).toBe("cadre");
  });
});

describe("normalizeFonction — juridique & informatique (reconciliation T1)", () => {
  it("Directeur juridique → département juridique", () => {
    expect(normalizeFonction("Directeur juridique").departementFonctionnel).toBe("juridique");
  });
  it("Juriste / Responsable juridique → juridique", () => {
    expect(normalizeFonction("Responsable juridique").departementFonctionnel).toBe("juridique");
    expect(normalizeFonction("Juriste").departementFonctionnel).toBe("juridique");
  });
  it("Directeur informatique → DSI", () => {
    expect(normalizeFonction("Directeur informatique")).toMatchObject({
      fonctionNormalisee: "directeur_des_systemes_information",
      departementFonctionnel: "dsi",
    });
  });
  it("Responsable informatique → DSI (séniorité responsable)", () => {
    expect(normalizeFonction("Responsable informatique")).toMatchObject({
      seniorite: "responsable",
      departementFonctionnel: "dsi",
    });
  });
  it("vide → autre/autre/autre", () => {
    expect(normalizeFonction("")).toEqual({
      fonctionNormalisee: "autre",
      seniorite: "autre",
      departementFonctionnel: "autre",
    });
  });
});
