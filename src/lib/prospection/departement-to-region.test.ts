import { describe, it, expect } from "vitest";
import {
  regionOfDepartement,
  regionLabelOfDepartement,
  normalizeDepartement,
  departementsOfRegion,
  ALL_DEPARTEMENTS,
  REGION_LABELS,
  REGION_CODES,
} from "./departement-to-region";

describe("normalizeDepartement", () => {
  it("zéro-pad les codes à 1 chiffre", () => {
    expect(normalizeDepartement("1")).toBe("01");
    expect(normalizeDepartement("5")).toBe("05");
  });
  it("préserve la Corse (2A/2B) et les DROM (3 chiffres)", () => {
    expect(normalizeDepartement("2a")).toBe("2A");
    expect(normalizeDepartement("974")).toBe("974");
  });
  it("gère null/undefined/vide", () => {
    expect(normalizeDepartement(null)).toBe("");
    expect(normalizeDepartement(undefined)).toBe("");
    expect(normalizeDepartement("  ")).toBe("");
  });
});

describe("regionOfDepartement", () => {
  it("mappe des départements connus", () => {
    expect(regionOfDepartement("38")).toBe("84"); // Isère → Auvergne-Rhône-Alpes
    expect(regionOfDepartement("75")).toBe("11"); // Paris → Île-de-France
    expect(regionOfDepartement("2A")).toBe("94"); // Corse
    expect(regionOfDepartement("974")).toBe("04"); // La Réunion
  });
  it("accepte les formes non normalisées", () => {
    expect(regionOfDepartement("1")).toBe("84"); // Ain
  });
  it("replie sur inconnu (jamais throw)", () => {
    expect(regionOfDepartement("999")).toBe("inconnu");
    expect(regionOfDepartement(null)).toBe("inconnu");
  });
});

describe("exhaustivité", () => {
  it("101 départements exactement", () => {
    expect(ALL_DEPARTEMENTS).toHaveLength(101);
  });
  it("tout département listé a une région ≠ inconnu", () => {
    for (const dep of ALL_DEPARTEMENTS) {
      expect(regionOfDepartement(dep)).not.toBe("inconnu");
    }
  });
  it("aucun département en double", () => {
    expect(new Set(ALL_DEPARTEMENTS).size).toBe(ALL_DEPARTEMENTS.length);
  });
  it("chaque code région a un libellé", () => {
    for (const code of REGION_CODES) {
      expect(REGION_LABELS[code]).toBeTruthy();
    }
  });
  it("13 régions métropole + 5 DROM (+ inconnu)", () => {
    expect(REGION_CODES).toHaveLength(19);
  });
});

describe("departementsOfRegion", () => {
  it("retourne les départements d'une région", () => {
    expect(departementsOfRegion("11")).toContain("75");
    expect(departementsOfRegion("84")).toContain("38");
  });
  it("vide pour inconnu", () => {
    expect(departementsOfRegion("inconnu")).toEqual([]);
  });
});

describe("regionLabelOfDepartement", () => {
  it("libellé correct", () => {
    expect(regionLabelOfDepartement("38")).toBe("Auvergne-Rhône-Alpes");
    expect(regionLabelOfDepartement("999")).toBe("Région inconnue");
  });
});

describe("couverture par région (un représentant par région)", () => {
  // Un département témoin par région → détecte un swap inter-régions.
  const TEMOINS: Record<string, string> = {
    "01": "971", // Guadeloupe
    "02": "972", // Martinique
    "03": "973", // Guyane
    "04": "974", // La Réunion
    "06": "976", // Mayotte
    "11": "75", // Île-de-France
    "24": "45", // Centre-Val de Loire (Loiret)
    "27": "21", // Bourgogne-Franche-Comté (Côte-d'Or)
    "28": "76", // Normandie (Seine-Maritime)
    "32": "59", // Hauts-de-France (Nord)
    "44": "67", // Grand Est (Bas-Rhin)
    "52": "44", // Pays de la Loire (Loire-Atlantique)
    "53": "35", // Bretagne (Ille-et-Vilaine)
    "75": "33", // Nouvelle-Aquitaine (Gironde)
    "76": "31", // Occitanie (Haute-Garonne)
    "84": "69", // Auvergne-Rhône-Alpes (Rhône)
    "93": "13", // PACA (Bouches-du-Rhône)
    "94": "2A", // Corse
  };
  it("chaque région a son témoin correctement rattaché (18 régions)", () => {
    expect(Object.keys(TEMOINS)).toHaveLength(18);
    for (const [region, dep] of Object.entries(TEMOINS)) {
      expect(regionOfDepartement(dep), `dep ${dep}`).toBe(region);
    }
  });
  it("legacy Corse '20' → région 94", () => {
    expect(regionOfDepartement("20")).toBe("94");
  });
});
