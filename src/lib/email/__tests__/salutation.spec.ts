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

  it.each([
    {},
    { prenom: "" },
    { prenom: "   " },
    { prenom: null },
    { prenom: 42 },
    { prenom: {} },
  ])("identité vide ou invalide %j → « Bonjour, »", (id) => {
    expect(salutation(id, "fr")).toBe("Bonjour,");
  });

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
    expect(salutation({ civilite, nomFamille: "Dupont" }, "fr")).toBe(`Bonjour ${attendu} Dupont,`);
  });

  it("nettoie espaces multiples et caractères de largeur nulle", () => {
    expect(salutation({ prenom: "  Michel\u200B   Ange " }, "fr")).toBe("Bonjour Michel Ange,");
    expect(salutation({ prenom: "Jean   Pierre" }, "fr")).toBe("Bonjour Jean Pierre,");
  });

  it.each([
    ["U+202E (inversion du sens d'écriture)", "\u202E"],
    ["U+2060", "\u2060"],
    ["U+00AD", "\u00AD"],
    ["U+2066", "\u2066"],
  ])("retire le caractère invisible de formatage %s", (_nom, c) => {
    expect(salutation({ civilite: "monsieur", nomFamille: `Dupont${c}` }, "fr")).toBe(
      "Bonjour Monsieur Dupont,",
    );
    expect(salutation({ prenom: `Mi${c}chel${c}` }, "fr")).toBe("Bonjour Michel,");
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
    expect(salutation({ civilite: "madame", nomFamille: "Dupont" }, "en")).toBe("Hello Ms Dupont,");
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
    expect(nettoyerNomPropre("a".repeat(41))).toBeNull();
    expect(nettoyerNomPropre("a".repeat(40))).not.toBeNull();
    expect(nettoyerNomPropre("enc:v1:xx")).toBeNull();
    expect(nettoyerNomPropre("[encrypted — key missing]")).toBeNull();
  });
});

// Lot S2 — noms durcis : l'adresse saisie peut être celle d'un tiers ; un « nom » piégé ne doit
// jamais ouvrir un e-mail parti de notre domaine (relais d'hameçonnage).
describe("noms piégés → « Bonjour, »", () => {
  it.each([
    "Gagnez un iPhone bit.ly/x",
    "bit.ly/x",
    "www.promo-gratuite",
    "promo.example.com",
    "https:",
    "Jean2",
    "0612345678",
    "jean@exemple.fr",
    "Jean : cliquez ici",
    "Un deux trois quatre cinq",
    "<b>Jean</b>",
    "Jean{{lien}}",
    "Jean=Pierre",
    "Jean Pierre Paul Jacques Luc Marc Matthieu Jude",
    "Dupont-Dupont-Dupont-Dupont-Dupont-Dupont",
  ])("« %s »", (piege) => {
    expect(nettoyerNomPropre(piege)).toBeNull();
    expect(salutation({ prenom: piege }, "fr")).toBe("Bonjour,");
    expect(salutation({ prenom: piege }, "en")).toBe("Hello,");
    expect(salutation({ civilite: "monsieur", nomFamille: piege }, "fr")).toBe("Bonjour,");
    expect(salutation({ civilite: "monsieur", nomFamille: piege, prenom: piege }, "fr")).toBe(
      "Bonjour,",
    );
  });

  it("un nom piégé n'empêche pas un prénom sain de passer", () => {
    expect(
      salutation({ civilite: "monsieur", nomFamille: "bit.ly/x", prenom: "Michel" }, "fr"),
    ).toBe("Bonjour Michel,");
  });

  it.each(["Jean-Pierre", "O'Brien", "Anne Marie", "de La Fontaine", "Élodie", "Müller", "Zoë"])(
    "un nom légitime « %s » passe toujours",
    (nom) => {
      expect(nettoyerNomPropre(nom, { particules: true })).not.toBeNull();
    },
  );
});

// Audit de sécurité S2, constat 1 : chaque ligne du tableau de l'audit.
describe("salutation : liste blanche des noms (audit S2, constat 1)", () => {
  it.each([
    ["paypal。com", "point idéographique U+3002"],
    ["paypal．com", "point pleine chasse U+FF0E"],
    ["paypal｡com", "point demi-chasse U+FF61"],
    ["paypal․com", "point de conduite U+2024"],
    ["paypal͏.xyz", "CGJ invisible puis domaine"],
    ["bit.l͏y", "domaine coupé par une marque invisible"],
    ["paypal-.xyz", "domaine avec trait d'union"],
    ["jean＠gmail", "arobase pleine chasse"],
    ["ｗｗｗ paypal", "www pleine chasse"],
    ["Rappelez ０６１２３４５６７８", "chiffres pleine chasse"],
    ["Appelez ٠٦١٢٣٤٥٦٧٨", "chiffres arabo-indiens"],
    ["Compteㅤbloquéㅤrépondezㅤàㅤceㅤmail", "remplissage hangûl"],
    ["Compte⠀bloqué⠀répondez⠀à⠀ce⠀mail", "blanc braille"],
    ["Compte bloqué, répondez vite", "virgule"],
    ["URGENT !!! Gagné ?", "points d'exclamation et d'interrogation"],
    ["Gagnez mille €", "symbole monétaire"],
    ['"Service" Paypal', "guillemets"],
    ["🎁 Cadeau", "emoji"],
    ["<Promo>", "chevrons"],
    ["J" + "́".repeat(9) + "an", "texte zalgo"],
    ["Jean‮moc.lapyap", "caractère bidirectionnel puis domaine"],
    ["Mary.Jane", "point collé entre deux noms (faux positif connu)"],
  ])("refuse %j (%s) → « Bonjour, »", (piege) => {
    expect(nettoyerNomPropre(piege)).toBeNull();
    expect(salutation({ prenom: piege }, "fr")).toBe("Bonjour,");
    expect(salutation({ civilite: "monsieur", nomFamille: piege }, "fr")).toBe("Bonjour,");
  });

  it("les caractères de contrôle séparent les mots au lieu de les coller", () => {
    expect(salutation({ prenom: "Jean\nCliquez ici" }, "fr")).toBe("Bonjour Jean Cliquez ici,");
    expect(salutation({ prenom: "Jean\tPierre" }, "fr")).toBe("Bonjour Jean Pierre,");
  });

  it("les invisibles de format (largeur nulle, bidi) restent supprimés", () => {
    expect(salutation({ prenom: "Je​an" }, "fr")).toBe("Bonjour Jean,");
    expect(salutation({ prenom: "‮elif" }, "fr")).toBe("Bonjour Elif,");
  });

  it("un A cyrillique passe (rien de plus que « Apple » en latin)", () => {
    expect(salutation({ prenom: "Аpple" }, "fr")).toBe("Bonjour Аpple,");
  });

  it("quatre mots sans ponctuation restent acceptés (« de la Tour d'Auvergne »)", () => {
    expect(
      salutation({ civilite: "monsieur", nomFamille: "Compte bloqué répondez vite" }, "fr"),
    ).toBe("Bonjour Monsieur Compte bloqué répondez vite,");
  });

  it.each([
    "O'Brien",
    "D’Arcy",
    "N'Diaye",
    "Jean-Pierre",
    "Marie-Ève",
    "de La Fontaine",
    "de Saint-Exupéry",
    "Ana María",
    "Zoë",
    "Ångström",
    "Łukasz",
    "Nguyễn",
    "Lê Văn Thành",
    "王小明",
    "محمد",
    "สมชาย",
    "Νίκος",
    "St. Clair",
  ])("le vrai nom « %s » reste accepté, sortie exacte", (nom) => {
    expect(nettoyerNomPropre(nom)).toBe(nom);
    expect(salutation({ prenom: nom }, "fr")).toBe(`Bonjour ${nom},`);
    expect(salutation({ prenom: nom }, "en")).toBe(`Hello ${nom},`);
  });
});
