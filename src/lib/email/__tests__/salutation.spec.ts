// La salutation des accusés : civilité + nom, sinon prénom, sinon rien.
// Jamais de civilité devinée, jamais le nom de famille seul, jamais une valeur
// chiffrée ou le marqueur de clé absente dans un bonjour.

import { describe, expect, it } from "vitest";

import { normaliserCivilite, nettoyerNomPropre, salutation } from "../salutation";

describe("salutation (fr)", () => {
  it("civilité + nom → « Bonjour Monsieur Dupont, »", () => {
    expect(salutation({ civilite: "monsieur", nomFamille: "Dupont" }, "fr")).toBe(
      "Bonjour Monsieur Dupont,",
    );
  });

  it("madame + nom + prénom → Madame Dupont (le prénom n'est pas dit)", () => {
    expect(salutation({ civilite: "madame", nomFamille: "Dupont", prenom: "Michel" }, "fr")).toBe(
      "Bonjour Madame Dupont,",
    );
  });

  it("prénom seul → « Bonjour Michel, »", () => {
    expect(salutation({ prenom: "Michel" }, "fr")).toBe("Bonjour Michel,");
  });

  it("civilité + prénom sans nom → le prénom", () => {
    expect(salutation({ civilite: "monsieur", prenom: "Michel" }, "fr")).toBe("Bonjour Michel,");
  });

  it("civilité seule → « Bonjour, »", () => {
    expect(salutation({ civilite: "monsieur" }, "fr")).toBe("Bonjour,");
  });

  it("nom seul → « Bonjour, » (jamais le nom de famille seul)", () => {
    expect(salutation({ nomFamille: "Dupont" }, "fr")).toBe("Bonjour,");
  });

  it.each([{}, { prenom: "" }, { prenom: "   " }, { prenom: null }, { prenom: 42 }, { prenom: {} }])(
    "identité vide ou invalide %j → « Bonjour, »",
    (id) => {
      expect(salutation(id, "fr")).toBe("Bonjour,");
    },
  );

  it("civilité inconnue (« docteur ») : on retombe sur le prénom", () => {
    expect(salutation({ civilite: "docteur", nomFamille: "Dupont", prenom: "Michel" }, "fr")).toBe(
      "Bonjour Michel,",
    );
  });

  it.each([
    ["Mme", "Madame"],
    ["Madame", "Madame"],
    ["M.", "Monsieur"],
    ["M", "Monsieur"],
  ])("civilité « %s » acceptée", (civilite, attendu) => {
    expect(salutation({ civilite, nomFamille: "Dupont" }, "fr")).toBe(
      `Bonjour ${attendu} Dupont,`,
    );
  });

  it("nettoie espaces multiples et caractères de largeur nulle", () => {
    expect(salutation({ prenom: "  Michel\u200B   Ange " }, "fr")).toBe("Bonjour Michel Ange,");
    expect(salutation({ prenom: "Jean   Pierre" }, "fr")).toBe("Bonjour Jean Pierre,");
  });

  it("retire la ponctuation finale : « Dupont, » → « Dupont »", () => {
    expect(salutation({ civilite: "monsieur", nomFamille: "Dupont," }, "fr")).toBe(
      "Bonjour Monsieur Dupont,",
    );
  });

  it("le marqueur de clé absente et les valeurs chiffrées ne finissent jamais dans un bonjour", () => {
    const marqueur = "[encrypted — key missing]";
    expect(salutation({ prenom: marqueur, nomFamille: marqueur, civilite: "madame" }, "fr")).toBe(
      "Bonjour,",
    );
    expect(salutation({ prenom: "enc:v1:aa:bb:cc", nomFamille: "enc:v2:aa:bb:cc" }, "fr")).toBe(
      "Bonjour,",
    );
  });

  it("locale inconnue = français", () => {
    expect(salutation({ prenom: "Michel" }, "de")).toBe("Bonjour Michel,");
  });

  it("le type refuse contactName", () => {
    // @ts-expect-error contactName (« Prénom Nom ») ne sert jamais à saluer
    expect(salutation({ contactName: "x" }, "fr")).toBe("Bonjour,");
  });
});

describe("salutation (en)", () => {
  it("les quatre cas", () => {
    expect(salutation({ civilite: "monsieur", nomFamille: "Dupont" }, "en")).toBe(
      "Hello Mr Dupont,",
    );
    expect(salutation({ civilite: "madame", nomFamille: "Dupont" }, "en")).toBe(
      "Hello Ms Dupont,",
    );
    expect(salutation({ prenom: "Michel" }, "en")).toBe("Hello Michel,");
    expect(salutation({}, "en")).toBe("Hello,");
  });
});

describe("normaliserCivilite", () => {
  it.each([
    [" Mme. ", "madame"],
    ["MONSIEUR", "monsieur"],
    ["mr.", "monsieur"],
    ["Mr", "monsieur"],
    ["docteur", null],
    ["", null],
    [undefined, null],
    [3, null],
  ])("%j → %j", (entree, attendu) => {
    expect(normaliserCivilite(entree)).toBe(attendu);
  });
});

describe("nettoyerNomPropre", () => {
  it("casse mixte rendue telle quelle", () => {
    expect(nettoyerNomPropre("McDonald")).toBe("McDonald");
    expect(nettoyerNomPropre("DiCaprio")).toBe("DiCaprio");
    expect(nettoyerNomPropre("Michel")).toBe("Michel");
  });

  it("tout en majuscules ou tout en minuscules : majuscule initiale par segment", () => {
    expect(nettoyerNomPropre("MICHEL")).toBe("Michel");
    expect(nettoyerNomPropre("jean-pierre")).toBe("Jean-Pierre");
    expect(nettoyerNomPropre("O'BRIEN")).toBe("O'Brien");
    expect(nettoyerNomPropre("o’brien")).toBe("O’Brien");
    expect(nettoyerNomPropre("anne marie")).toBe("Anne Marie");
  });

  it("particules en minuscules sauf en dernier mot (option)", () => {
    expect(nettoyerNomPropre("DE LA FONTAINE", { particules: true })).toBe("de La Fontaine");
    expect(nettoyerNomPropre("le pen", { particules: true })).toBe("Le Pen");
    expect(nettoyerNomPropre("VAN DER BERG", { particules: true })).toBe("van der Berg");
    expect(nettoyerNomPropre("de", { particules: true })).toBe("De");
    expect(nettoyerNomPropre("DE LA FONTAINE")).toBe("De La Fontaine");
  });

  it("refuse le non-présentable", () => {
    expect(nettoyerNomPropre(null)).toBeNull();
    expect(nettoyerNomPropre("   ")).toBeNull();
    expect(nettoyerNomPropre("-")).toBeNull();
    expect(nettoyerNomPropre("12 34")).toBeNull();
    expect(nettoyerNomPropre("a".repeat(81))).toBeNull();
    expect(nettoyerNomPropre("a".repeat(80))).not.toBeNull();
    expect(nettoyerNomPropre("enc:v1:xx")).toBeNull();
    expect(nettoyerNomPropre("[encrypted — key missing]")).toBeNull();
  });
});
