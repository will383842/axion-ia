import { describe, it, expect } from "vitest";
import {
  tailleFromEffectif,
  tailleFromTranche,
  tailleFromCategorieInsee,
  deriveTaille,
  isKnownTranche,
  TAILLE_BORNES,
} from "./taille";

describe("tailleFromEffectif — bornes exactes", () => {
  it("TPE < 10", () => {
    expect(tailleFromEffectif(0)).toBe("TPE");
    expect(tailleFromEffectif(9)).toBe("TPE");
  });
  it("PME 10-249", () => {
    expect(tailleFromEffectif(10)).toBe("PME");
    expect(tailleFromEffectif(249)).toBe("PME");
  });
  it("ETI 250-4999", () => {
    expect(tailleFromEffectif(250)).toBe("ETI");
    expect(tailleFromEffectif(4999)).toBe("ETI");
  });
  it("GE ≥ 5000", () => {
    expect(tailleFromEffectif(5000)).toBe("GE");
    expect(tailleFromEffectif(50000)).toBe("GE");
  });
  it("les bornes officielles sont cohérentes", () => {
    expect(TAILLE_BORNES.TPE.maxInclus).toBe(9);
    expect(TAILLE_BORNES.PME.minInclus).toBe(10);
    expect(TAILLE_BORNES.ETI.minInclus).toBe(250);
    expect(TAILLE_BORNES.GE.minInclus).toBe(5000);
  });
});

describe("tailleFromTranche — codes INSEE", () => {
  it("codes TPE (00,01,02,03)", () => {
    for (const c of ["00", "01", "02", "03"]) expect(tailleFromTranche(c)).toBe("TPE");
  });
  it("codes PME (11,12,21,22,31)", () => {
    for (const c of ["11", "12", "21", "22", "31"]) expect(tailleFromTranche(c)).toBe("PME");
  });
  it("codes ETI (32,41,42,51)", () => {
    for (const c of ["32", "41", "42", "51"]) expect(tailleFromTranche(c)).toBe("ETI");
  });
  it("codes GE (52,53)", () => {
    for (const c of ["52", "53"]) expect(tailleFromTranche(c)).toBe("GE");
  });
  it("code inconnu/NN → null (on ne devine pas)", () => {
    expect(tailleFromTranche("NN")).toBeNull();
    expect(tailleFromTranche("")).toBeNull();
    expect(tailleFromTranche(null)).toBeNull();
    expect(tailleFromTranche("99")).toBeNull();
  });
});

describe("tailleFromCategorieInsee", () => {
  it("PME/ETI/GE", () => {
    expect(tailleFromCategorieInsee("PME")).toBe("PME");
    expect(tailleFromCategorieInsee("ETI")).toBe("ETI");
    expect(tailleFromCategorieInsee("GE")).toBe("GE");
    expect(tailleFromCategorieInsee(null)).toBeNull();
  });
});

describe("deriveTaille — priorité effectif, repli catégorie", () => {
  it("priorité à l'effectif (distingue TPE)", () => {
    expect(deriveTaille({ trancheEffectif: "01", categorieEntreprise: "PME" })).toEqual({
      taille: "TPE",
      source: "effectif",
    });
  });
  it("repli sur catégorie INSEE si tranche absente", () => {
    expect(deriveTaille({ trancheEffectif: "NN", categorieEntreprise: "ETI" })).toEqual({
      taille: "ETI",
      source: "categorie_insee",
    });
  });
  it("null si aucune source", () => {
    expect(deriveTaille({ trancheEffectif: null, categorieEntreprise: null })).toBeNull();
  });
});

describe("isKnownTranche", () => {
  it("true/false", () => {
    expect(isKnownTranche("11")).toBe(true);
    expect(isKnownTranche("NN")).toBe(false);
  });
});
