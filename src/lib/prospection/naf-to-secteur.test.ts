import { describe, it, expect } from "vitest";
import {
  secteurFromNaf,
  sectionFromNaf,
  nafDivision,
  nafDigits,
  nafPrefixesForSecteur,
  nafPrefixesForSecteurs,
  SECTEUR_PREFIXES,
} from "./naf-to-secteur";
import { SECTEURS } from "./enums";

// Divisions NAF rév.2 valides (INSEE).
const VALID_DIVISIONS = [
  "01",
  "02",
  "03",
  "05",
  "06",
  "07",
  "08",
  "09",
  ...Array.from({ length: 24 }, (_, i) => String(10 + i).padStart(2, "0")), // 10..33
  "35",
  "36",
  "37",
  "38",
  "39",
  "41",
  "42",
  "43",
  "45",
  "46",
  "47",
  "49",
  "50",
  "51",
  "52",
  "53",
  "55",
  "56",
  "58",
  "59",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "68",
  "69",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "77",
  "78",
  "79",
  "80",
  "81",
  "82",
  "84",
  "85",
  "86",
  "87",
  "88",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
];

describe("nafDigits / nafDivision", () => {
  it("extrait les chiffres", () => {
    expect(nafDigits("69.10Z")).toBe("6910");
    expect(nafDivision("69.10Z")).toBe("69");
    expect(nafDivision("F")).toBe("");
  });
});

describe("exhaustivité — 100 % des divisions mappées", () => {
  it("chaque division valide (sauf 99) mappe vers un secteur ≠ autre", () => {
    for (const div of VALID_DIVISIONS) {
      const secteur = secteurFromNaf(`${div}.00Z`);
      if (div === "99") {
        expect(secteur).toBe("autre");
      } else {
        expect(secteur, `division ${div}`).not.toBe("autre");
      }
      expect(SECTEURS).toContain(secteur);
    }
  });
  it("repli autre sur code vide/invalide (jamais null)", () => {
    expect(secteurFromNaf("")).toBe("autre");
    expect(secteurFromNaf(null)).toBe("autre");
    expect(secteurFromNaf("Z")).toBe("autre");
  });
});

describe("secteurs clés (pilote BTP + Santé + Droit)", () => {
  it("BTP (division F 41-43)", () => {
    expect(secteurFromNaf("41.20A")).toBe("btp");
    expect(secteurFromNaf("43.99Z")).toBe("btp");
  });
  it("Santé (86,87) vs action sociale (88)", () => {
    expect(secteurFromNaf("86.10Z")).toBe("sante");
    expect(secteurFromNaf("87.10A")).toBe("sante");
    expect(secteurFromNaf("88.10A")).toBe("action_sociale");
  });
  it("Droit (691) l'emporte sur conseil (69/692) — longest prefix", () => {
    expect(secteurFromNaf("69.10Z")).toBe("droit");
    expect(secteurFromNaf("69.20Z")).toBe("conseil");
  });
  it("Numérique (62)", () => {
    expect(secteurFromNaf("62.01Z")).toBe("numerique");
  });
});

describe("sectionFromNaf", () => {
  it("lettres de section", () => {
    expect(sectionFromNaf("41.20A")).toBe("F");
    expect(sectionFromNaf("86.10Z")).toBe("Q");
    expect(sectionFromNaf("62.01Z")).toBe("J");
    expect(sectionFromNaf("")).toBe("");
  });
});

describe("reverse — nafPrefixesForSecteur", () => {
  it("chaque secteur a au moins un préfixe", () => {
    for (const s of SECTEURS) expect(nafPrefixesForSecteur(s).length).toBeGreaterThan(0);
  });
  it("le préfixe droit contient bien 691", () => {
    expect(SECTEUR_PREFIXES.droit).toContain("691");
  });
  it("détend + déduplique une liste de secteurs", () => {
    const prefixes = nafPrefixesForSecteurs(["btp", "sante"]);
    expect(prefixes).toEqual(expect.arrayContaining(["41", "42", "43", "86", "87"]));
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
  it("cohérence aller-retour : un code bâti sur un préfixe de secteur remappe ce secteur", () => {
    for (const s of SECTEURS) {
      for (const prefix of nafPrefixesForSecteur(s)) {
        // pad à une division/groupe plausible
        const code = `${prefix}00`.slice(0, 4);
        expect(secteurFromNaf(code)).toBe(s);
      }
    }
  });
});
