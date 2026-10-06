import { describe, expect, it } from "vitest";
import { ajouterJoursOuvres, estJourFerieFrance, joursFeriesFrance } from "../jours-ouvres";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const midi = (s: string) => new Date(`${s}T10:00:00Z`);

describe("joursFeriesFrance", () => {
  it("2026 : Pâques le 5 avril donc lundi de Pâques le 6 avril", () => {
    const f = joursFeriesFrance(2026);
    expect(f).toContain("2026-04-06");
    expect(f).not.toContain("2026-04-05");
  });
  it("2026 : onze jours fériés, dont Ascension 14 mai et lundi de Pentecôte 25 mai", () => {
    const f = joursFeriesFrance(2026);
    expect(f).toHaveLength(11);
    expect(f).toContain("2026-05-14");
    expect(f).toContain("2026-05-25");
  });
  it("les jours fixes sont présents : 1er janvier, 1er et 8 mai, 14 juillet, 15 août, 1er et 11 novembre, 25 décembre", () => {
    const f = joursFeriesFrance(2026);
    for (const j of ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"])
      expect(f).toContain(`2026-${j}`);
  });
  it("Pâques 2025 = 20 avril donc lundi 21, Pâques 2027 = 28 mars (algorithme grégorien)", () => {
    expect(joursFeriesFrance(2025)).toContain("2025-04-21");
    expect(joursFeriesFrance(2027)).toContain("2027-03-29");
  });
  it("estJourFerieFrance reconnaît le 1er mai 2026 et pas le 4 mai", () => {
    expect(estJourFerieFrance(midi("2026-05-01"))).toBe(true);
    expect(estJourFerieFrance(midi("2026-05-04"))).toBe(false);
  });
});

describe("ajouterJoursOuvres", () => {
  it("dix jours ouvrés depuis un lundi sans férié : le lundi deux semaines plus tard", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-10-05"), 10))).toBe("2026-10-19");
  });
  it("depuis un vendredi : les week-ends ne comptent pas", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-10-09"), 10))).toBe("2026-10-23");
  });
  it("le lundi de Pâques est sauté : vendredi 3 avril 2026 + 1 jour ouvré = mardi 7 avril", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-04-03"), 1))).toBe("2026-04-07");
  });
  it("le 1er mai 2026 (vendredi) est sauté : jeudi 30 avril + 1 = lundi 4 mai", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-04-30"), 1))).toBe("2026-05-04");
  });
  it("Noël 2026 tombe un vendredi : jeudi 24 décembre + 1 = lundi 28 décembre", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-12-24"), 1))).toBe("2026-12-28");
  });
  it("depuis le jeudi veille de férié (30 avril 2026) : dix jours ouvrés sautent le 1er mai, le 8 mai et l'Ascension", () => {
    // 4,5,6,7 mai (4 jours, le 8 est férié) ; 11,12,13 (7) ; 14 férié (Ascension) ; 15 (8) ; 18 (9) ; 19 (10).
    expect(iso(ajouterJoursOuvres(midi("2026-04-30"), 10))).toBe("2026-05-19");
  });
  it("passage d'année : 31 décembre 2026 + 1 = lundi 4 janvier 2027 (le 1er est férié, 2-3 week-end)", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-12-31"), 1))).toBe("2027-01-04");
  });
  it("zéro jour ouvré : la date est inchangée", () => {
    expect(iso(ajouterJoursOuvres(midi("2026-10-05"), 0))).toBe("2026-10-05");
  });
});
