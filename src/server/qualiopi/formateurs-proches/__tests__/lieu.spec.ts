/** Lot L15a — lieu d'exercice : code postal, commune choisie. */

import { describe, expect, it } from "vitest";

import { choisirCommune, extraireCodePostal, nomComparable, normaliserCodePostal } from "../lieu";

const c = (codeInsee: string, nom: string, population: number | null) => ({
  codeInsee,
  nom,
  latitude: 45,
  longitude: 5,
  departement: codeInsee.slice(0, 2),
  population,
});

describe("normaliserCodePostal", () => {
  it.each([
    ["74000", "74000"],
    [" 74 000 ", "74000"],
    ["3800", null],
    ["2A000", null],
    ["", null],
    [null, null],
  ])("%s → %s", (s, attendu) => expect(normaliserCodePostal(s)).toBe(attendu));
});

describe("extraireCodePostal", () => {
  it("prend le code postal d'une adresse libre", () => {
    expect(extraireCodePostal("12 rue des Alpes, 74000 Annecy")).toBe("74000");
    expect(extraireCodePostal("3 place X 01 000 Bourg-en-Bresse")).toBe("01000");
  });
  it("ignore un SIRET collé et une adresse sans code", () => {
    expect(extraireCodePostal("SIRET 12345678901234")).toBeNull();
    expect(extraireCodePostal("Annecy")).toBeNull();
    expect(extraireCodePostal(null)).toBeNull();
  });
});

describe("choisirCommune", () => {
  const cands = [c("38001", "Saint-Égrève", 16_000), c("38002", "Le Fontanil", 3_000)];
  it("le nom saisi l'emporte (accents, Saint/St, casse)", () => {
    expect(choisirCommune(cands, "st egreve")).toMatchObject({
      commune: { codeInsee: "38001" },
      approximatif: false,
    });
    expect(nomComparable("Saint-Égrève")).toBe(nomComparable("ST EGREVE"));
  });
  it("sinon la plus peuplée, marquée approximative", () => {
    expect(choisirCommune(cands, "Inconnue")).toMatchObject({
      commune: { codeInsee: "38001" },
      approximatif: true,
    });
  });
  it("une seule commune : jamais approximatif", () => {
    expect(choisirCommune([c("01053", "Bourg-en-Bresse", 41_000)], null)).toMatchObject({
      approximatif: false,
    });
  });
  it("aucune → null", () => expect(choisirCommune([], "x")).toBeNull());
});
