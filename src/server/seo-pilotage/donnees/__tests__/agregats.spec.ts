import { describe, expect, it } from "vitest";
import {
  cumulerParSemaineIso,
  partAnonymisee,
  positionMoyenne,
  positionSum,
  semaineIso,
} from "../agregats";

describe("positionSum / positionMoyenne", () => {
  it("positionSum = position × impressions", () => {
    expect(positionSum(4.5, 10)).toBe(45);
    expect(positionSum(1, 0)).toBe(0);
  });

  it("position nulle quand il n'y a aucune impression", () => {
    expect(positionMoyenne(0, 0)).toBeNull();
    expect(positionMoyenne(12, 0)).toBeNull();
    expect(positionMoyenne(45, -3)).toBeNull();
  });

  it("moyenne pondérée exacte sur un cumul", () => {
    // jour 1 : position 2 sur 10 impressions ; jour 2 : position 8 sur 30
    const somme = positionSum(2, 10) + positionSum(8, 30);
    expect(positionMoyenne(somme, 40)).toBeCloseTo(6.5, 10);
  });

  it("refuse les valeurs non finies ou négatives", () => {
    expect(positionSum(Number.NaN, 10)).toBe(0);
    expect(positionSum(3, Number.NaN)).toBe(0);
    expect(positionSum(-1, 10)).toBe(0);
    expect(positionMoyenne(Number.NaN, 10)).toBeNull();
  });
});

describe("partAnonymisee", () => {
  it("part des impressions de la page absentes du détail par requête", () => {
    expect(partAnonymisee(100, 60)).toBeCloseTo(0.4, 10);
    expect(partAnonymisee(100, 100)).toBe(0);
  });

  it("nulle sans impressions", () => {
    expect(partAnonymisee(0, 0)).toBeNull();
  });

  it("borne dans [0, 1] quand le détail dépasse le total (arrondis Google)", () => {
    expect(partAnonymisee(100, 120)).toBe(0);
    expect(partAnonymisee(100, -5)).toBe(1);
  });
});

describe("semaineIso", () => {
  it("jour ordinaire", () => {
    expect(semaineIso("2026-11-27")).toEqual({
      annee: 2026,
      semaine: 48,
      cle: "2026-W48",
      debut: "2026-11-23",
    });
  });

  it("frontière d'année : 1er janvier rattaché à la semaine 53 de l'année précédente", () => {
    expect(semaineIso("2021-01-01")).toMatchObject({ annee: 2020, semaine: 53, cle: "2020-W53" });
    expect(semaineIso("2021-01-03")).toMatchObject({ annee: 2020, semaine: 53 });
    expect(semaineIso("2021-01-04")).toMatchObject({
      annee: 2021,
      semaine: 1,
      debut: "2021-01-04",
    });
  });

  it("frontière d'année : fin décembre rattachée à la semaine 1 de l'année suivante", () => {
    expect(semaineIso("2024-12-30")).toMatchObject({
      annee: 2025,
      semaine: 1,
      cle: "2025-W01",
      debut: "2024-12-30",
    });
    expect(semaineIso("2024-12-29")).toMatchObject({ annee: 2024, semaine: 52 });
  });

  it("le début de semaine peut tomber l'année précédente", () => {
    expect(semaineIso("2026-01-01")).toMatchObject({
      annee: 2026,
      semaine: 1,
      debut: "2025-12-29",
    });
  });

  it("refuse une date mal formée ou impossible", () => {
    expect(() => semaineIso("27/11/2026")).toThrow();
    expect(() => semaineIso("2026-02-30")).toThrow();
  });
});

describe("cumulerParSemaineIso", () => {
  const lignes = [
    { date: "2024-12-29", cle: "a", clics: 1, impressions: 10, positionSum: 20 },
    { date: "2024-12-30", cle: "a", clics: 2, impressions: 10, positionSum: 60 },
    { date: "2024-12-31", cle: "a", clics: 3, impressions: 20, positionSum: 40 },
    { date: "2024-12-31", cle: "b", clics: 0, impressions: 5, positionSum: 5 },
  ];

  it("cumule par clé et par semaine ISO, positions pondérées exactes", () => {
    const sortie = cumulerParSemaineIso(lignes);
    const a52 = sortie.find((l) => l.cle === "a" && l.semaine === "2024-W52");
    const a01 = sortie.find((l) => l.cle === "a" && l.semaine === "2025-W01");
    expect(a52).toMatchObject({ clics: 1, impressions: 10, positionSum: 20, jours: 1 });
    expect(a01).toMatchObject({ clics: 5, impressions: 30, positionSum: 100, jours: 2 });
    expect(a01!.position).toBeCloseTo(100 / 30, 10);
    expect(sortie).toHaveLength(3);
  });

  it("ne modifie pas l'entrée et trie de façon stable", () => {
    const copie = JSON.stringify(lignes);
    const sortie = cumulerParSemaineIso(lignes);
    expect(JSON.stringify(lignes)).toBe(copie);
    expect(sortie.map((l) => `${l.semaine}/${l.cle}`)).toEqual([
      "2024-W52/a",
      "2025-W01/a",
      "2025-W01/b",
    ]);
  });

  it("position nulle quand la semaine n'a aucune impression", () => {
    const [l] = cumulerParSemaineIso([
      { date: "2026-11-27", cle: "x", clics: 0, impressions: 0, positionSum: 0 },
    ]);
    expect(l!.position).toBeNull();
  });

  it("neutralise NaN et valeurs négatives", () => {
    const [l] = cumulerParSemaineIso([
      { date: "2026-11-27", cle: "x", clics: Number.NaN, impressions: -4, positionSum: Number.NaN },
    ]);
    expect(l).toMatchObject({ clics: 0, impressions: 0, positionSum: 0, position: null });
  });

  it("liste vide", () => {
    expect(cumulerParSemaineIso([])).toEqual([]);
  });
});
