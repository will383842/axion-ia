import { describe, expect, it } from "vitest";
import {
  ajouterJours,
  ajouterJoursOuvres,
  estFerie,
  estJourOuvre,
  joursRestants,
} from "../jours-ouvres";

describe("estFerie : Pâques et fêtes mobiles", () => {
  it.each([
    ["2026-04-06", "lundi de Pâques 2026 (Pâques = 5 avril)"],
    ["2027-03-29", "lundi de Pâques 2027 (Pâques = 28 mars)"],
    ["2028-04-17", "lundi de Pâques 2028 (Pâques = 16 avril)"],
    ["2026-05-14", "Ascension 2026"],
    ["2026-05-25", "lundi de Pentecôte 2026"],
  ])("%s est férié (%s)", (jour) => {
    expect(estFerie(jour)).toBe(true);
  });
  it("le dimanche de Pâques n'est pas, lui, un férié du calendrier (c'est un dimanche)", () => {
    expect(estFerie("2026-04-05")).toBe(false);
    expect(estFerie("2027-03-28")).toBe(false);
    expect(estFerie("2028-04-16")).toBe(false);
  });
  it("les jours fixes sont fériés", () => {
    for (const j of ["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"])
      expect(estFerie(`2026-${j}`)).toBe(true);
    expect(estFerie("2026-12-24")).toBe(false);
  });
});

describe("estJourOuvre", () => {
  it("ni week-end ni férié", () => {
    expect(estJourOuvre("2026-12-01")).toBe(true); // mardi
    expect(estJourOuvre("2026-11-28")).toBe(false); // samedi
    expect(estJourOuvre("2026-11-29")).toBe(false); // dimanche
    expect(estJourOuvre("2026-05-25")).toBe(false); // lundi de Pentecôte
    expect(estJourOuvre("2026-12-25")).toBe(false); // vendredi férié
  });
});

describe("ajouterJoursOuvres (jour civil)", () => {
  it("journée le lundi 2026-12-01 : 10 jours ouvrés → 2026-12-15", () => {
    expect(ajouterJoursOuvres("2026-12-01", 10)).toBe("2026-12-15");
  });
  it("journée le 2026-12-18 : saute le 25 décembre et le 1er janvier → 2027-01-05", () => {
    expect(ajouterJoursOuvres("2026-12-18", 10)).toBe("2027-01-05");
  });
  it("le lundi de Pentecôte est sauté (jeudi 21 mai 2026 + 3 → jeudi 28 mai)", () => {
    expect(ajouterJoursOuvres("2026-05-21", 3)).toBe("2026-05-27");
    expect(ajouterJoursOuvres("2026-05-22", 1)).toBe("2026-05-26");
  });
  it("garde la forme Date existante (compatibilité)", () => {
    const r = ajouterJoursOuvres(new Date("2026-10-05T10:00:00Z"), 10);
    expect(r.toISOString().slice(0, 10)).toBe("2026-10-19");
  });
});

describe("ajouterJours / joursRestants", () => {
  it("jours calendaires, à travers fin de mois et d'année", () => {
    expect(ajouterJours("2026-12-20", 30)).toBe("2027-01-19");
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("différence en jours, négative si dépassée", () => {
    expect(joursRestants("2026-12-10", "2026-12-01")).toBe(9);
    expect(joursRestants("2026-12-01", "2026-12-01")).toBe(0);
    expect(joursRestants("2026-12-01", "2026-12-04")).toBe(-3);
  });
});
