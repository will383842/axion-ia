/**
 * Saisie d'une dépense : montant 0-100 000 €, date ≤ aujourd'hui, canal fermé,
 * centimes entiers.
 */
import { describe, it, expect } from "vitest";
import { eurosEnCentimes, validerDepense, type SaisieDepense } from "../depenses";

const AUJOURDHUI = "2026-10-06";
const base: SaisieDepense = {
  spentOn: "2026-10-05",
  canal: "facebook",
  campagne: " apporteurs-video ",
  montantEuros: "12,50",
  note: "",
};

describe("eurosEnCentimes", () => {
  it("convertit en centimes ENTIERS", () => {
    expect(eurosEnCentimes("12,50")).toBe(1250);
    expect(eurosEnCentimes("12.5")).toBe(1250);
    expect(eurosEnCentimes("1 250")).toBe(125_000);
    expect(eurosEnCentimes("0")).toBe(0);
    expect(eurosEnCentimes("0,07")).toBe(7);
  });
  it("refuse ce qui n'est pas un montant", () => {
    for (const v of ["", "abc", "-5", "1,234", "1e3", "12,5,0", "€12"]) {
      expect(eurosEnCentimes(v), v).toBeNull();
    }
  });
});

describe("validerDepense", () => {
  it("accepte une saisie correcte et nettoie les champs", () => {
    const r = validerDepense(base, AUJOURDHUI);
    expect(r).toEqual({
      ok: true,
      valeur: {
        spentOn: new Date("2026-10-05T00:00:00.000Z"),
        canal: "facebook",
        campagne: "apporteurs-video",
        montantCentimes: 1250,
        note: null,
      },
    });
  });

  it("montant : 0 accepté, 100 000 € accepté, au-delà refusé", () => {
    expect(validerDepense({ ...base, montantEuros: "0" }, AUJOURDHUI).ok).toBe(true);
    expect(validerDepense({ ...base, montantEuros: "100000" }, AUJOURDHUI).ok).toBe(true);
    expect(validerDepense({ ...base, montantEuros: "100000,01" }, AUJOURDHUI).ok).toBe(false);
    expect(validerDepense({ ...base, montantEuros: "-1" }, AUJOURDHUI).ok).toBe(false);
  });

  it("date : aujourd'hui acceptée, demain refusée, jour impossible refusé", () => {
    expect(validerDepense({ ...base, spentOn: AUJOURDHUI }, AUJOURDHUI).ok).toBe(true);
    expect(validerDepense({ ...base, spentOn: "2026-10-07" }, AUJOURDHUI)).toEqual({
      ok: false,
      erreur: "La date ne peut pas être dans le futur.",
    });
    expect(validerDepense({ ...base, spentOn: "2026-02-30" }, AUJOURDHUI).ok).toBe(false);
    expect(validerDepense({ ...base, spentOn: "05/10/2026" }, AUJOURDHUI).ok).toBe(false);
  });

  it("canal : liste fermée", () => {
    expect(validerDepense({ ...base, canal: "tiktok" }, AUJOURDHUI).ok).toBe(false);
    for (const c of ["facebook", "instagram", "linkedin", "autre"]) {
      expect(validerDepense({ ...base, canal: c }, AUJOURDHUI).ok).toBe(true);
    }
  });

  it("bornes de longueur : campagne 120, note 300", () => {
    expect(validerDepense({ ...base, campagne: "x".repeat(121) }, AUJOURDHUI).ok).toBe(false);
    expect(validerDepense({ ...base, note: "x".repeat(301) }, AUJOURDHUI).ok).toBe(false);
    expect(validerDepense({ ...base, note: "x".repeat(300) }, AUJOURDHUI).ok).toBe(true);
  });
});
