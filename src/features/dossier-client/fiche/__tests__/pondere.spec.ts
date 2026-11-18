/** Lot B8 : montant pondéré en centimes entiers et lecture des saisies (chances, clôture). */

import { describe, expect, it } from "vitest";

import { lireChancesSaisies, lireClotureSaisie, montantPondereCents } from "../pondere";

describe("montantPondereCents", () => {
  it("4 500 € à 60 % donnent 2 700 €", () => {
    expect(montantPondereCents(450000, 60)).toBe(270000);
  });
  it("0 % donne 0, 100 % rend le montant", () => {
    expect(montantPondereCents(450000, 0)).toBe(0);
    expect(montantPondereCents(450000, 100)).toBe(450000);
  });
  it("montant absent ou chances absentes : null, jamais 0", () => {
    expect(montantPondereCents(null, 60)).toBeNull();
    expect(montantPondereCents(450000, null)).toBeNull();
    expect(montantPondereCents(null, null)).toBeNull();
  });
  it("un montant de 0 € reste 0", () => {
    expect(montantPondereCents(0, 60)).toBe(0);
  });
  it("arrondit au centime, le demi-centime vers le haut", () => {
    expect(montantPondereCents(1, 50)).toBe(1); // 0,5 centime
    expect(montantPondereCents(1, 49)).toBe(0); // 0,49
    expect(montantPondereCents(999, 33)).toBe(330); // 329,67
    expect(montantPondereCents(10001, 50)).toBe(5001); // 5000,5
  });
  it("sortie entière même sur le plus grand montant permis", () => {
    const r = montantPondereCents(999999900, 37);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBe(369999963);
  });
  it("refuse les entrées hors bornes", () => {
    expect(montantPondereCents(-1, 50)).toBeNull();
    expect(montantPondereCents(1000, 101)).toBeNull();
    expect(montantPondereCents(1000, -1)).toBeNull();
    expect(montantPondereCents(1000, 50.5)).toBeNull();
  });
});

describe("lireChancesSaisies", () => {
  it("vide = non estimées (null)", () => {
    expect(lireChancesSaisies("")).toBeNull();
    expect(lireChancesSaisies("  ")).toBeNull();
  });
  it("bornes 0 et 100 acceptées", () => {
    expect(lireChancesSaisies("0")).toBe(0);
    expect(lireChancesSaisies("100")).toBe(100);
    expect(lireChancesSaisies("60")).toBe(60);
  });
  it("101 et -1 refusés", () => {
    expect(lireChancesSaisies("101")).toBeUndefined();
    expect(lireChancesSaisies("-1")).toBeUndefined();
  });
  it("décimaux et texte refusés", () => {
    expect(lireChancesSaisies("50,5")).toBeUndefined();
    expect(lireChancesSaisies("50.5")).toBeUndefined();
    expect(lireChancesSaisies("abc")).toBeUndefined();
    expect(lireChancesSaisies("1000")).toBeUndefined();
  });
});

describe("lireClotureSaisie", () => {
  it("vide = null, date réelle acceptée", () => {
    expect(lireClotureSaisie("")).toBeNull();
    expect(lireClotureSaisie("2026-12-15")).toBe("2026-12-15");
    expect(lireClotureSaisie("2028-02-29")).toBe("2028-02-29");
  });
  it("dates impossibles ou mal écrites refusées", () => {
    expect(lireClotureSaisie("2026-02-30")).toBeUndefined();
    expect(lireClotureSaisie("2027-02-29")).toBeUndefined();
    expect(lireClotureSaisie("2026-13-01")).toBeUndefined();
    expect(lireClotureSaisie("15/12/2026")).toBeUndefined();
    expect(lireClotureSaisie("2026-1-5")).toBeUndefined();
    expect(lireClotureSaisie("1999-01-01")).toBeUndefined();
  });
});
