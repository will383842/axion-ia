/**
 * Tests — opco-referentiel.ts (Lot 5, module PUR).
 *
 * Couvre : liste canonique + garde de type isOpcoId, opcoLabel (fallback),
 * estBaremePerime (seuil mois, relevé absent = périmé, bornes).
 */

import { describe, it, expect } from "vitest";
import { OPCO_IDS, OPCO_LABELS, isOpcoId, opcoLabel, estBaremePerime } from "./opco-referentiel";

describe("OPCO_IDS / OPCO_LABELS", () => {
  it("contient les 11 OPCO agréés", () => {
    expect(OPCO_IDS).toHaveLength(11);
  });

  it("préserve les 5 identifiants déjà émis par inferOpcoFromNaf (verbatim)", () => {
    for (const id of ["atlas", "akto", "opco2i", "constructys", "opcommerce"] as const) {
      expect(OPCO_IDS).toContain(id);
    }
  });

  it("a un libellé pour chaque identifiant", () => {
    for (const id of OPCO_IDS) {
      expect(OPCO_LABELS[id]).toBeTruthy();
    }
  });
});

describe("isOpcoId", () => {
  it("vrai pour un identifiant connu", () => {
    expect(isOpcoId("atlas")).toBe(true);
    expect(isOpcoId("opco_sante")).toBe(true);
  });

  it("faux pour inconnu / null / undefined / vide", () => {
    expect(isOpcoId("inconnu")).toBe(false);
    expect(isOpcoId(null)).toBe(false);
    expect(isOpcoId(undefined)).toBe(false);
    expect(isOpcoId("")).toBe(false);
  });
});

describe("opcoLabel", () => {
  it("renvoie le libellé pour un OPCO connu", () => {
    expect(opcoLabel("atlas")).toBe("Atlas");
    expect(opcoLabel("opco2i")).toBe("OPCO 2i");
  });

  it("renvoie la chaîne brute pour un OPCO inconnu", () => {
    expect(opcoLabel("mystere")).toBe("mystere");
  });

  it("renvoie « — » pour null/undefined", () => {
    expect(opcoLabel(null)).toBe("—");
    expect(opcoLabel(undefined)).toBe("—");
  });
});

describe("estBaremePerime", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("relevé absent → périmé", () => {
    expect(estBaremePerime(null, 12, now)).toBe(true);
    expect(estBaremePerime(undefined, 12, now)).toBe(true);
  });

  it("relevé récent (< seuil) → non périmé", () => {
    expect(estBaremePerime(new Date("2026-05-01T00:00:00.000Z"), 12, now)).toBe(false);
  });

  it("relevé plus vieux que le seuil → périmé", () => {
    // 14 mois avant now, seuil 12 mois
    expect(estBaremePerime(new Date("2025-05-01T00:00:00.000Z"), 12, now)).toBe(true);
  });

  it("relevé exactement au seuil → non périmé (strictement <)", () => {
    // now - 12 mois = 2025-07-13
    expect(estBaremePerime(new Date("2025-07-13T12:00:00.000Z"), 12, now)).toBe(false);
  });

  it("respecte un seuil personnalisé (6 mois)", () => {
    expect(estBaremePerime(new Date("2026-01-01T00:00:00.000Z"), 6, now)).toBe(true);
    expect(estBaremePerime(new Date("2026-03-01T00:00:00.000Z"), 6, now)).toBe(false);
  });

  it("gère la fin de mois sans débordement (31 mars − 1 mois = 28 févr, pas 3 mars)", () => {
    const finMars = new Date("2026-03-31T12:00:00.000Z");
    // Seuil = 28 févr 2026 ; un relevé du 10 mars est donc DANS la validité (non périmé).
    expect(estBaremePerime(new Date("2026-03-10T12:00:00.000Z"), 1, finMars)).toBe(false);
    // Un relevé du 20 févr (avant le 28 févr) est périmé.
    expect(estBaremePerime(new Date("2026-02-20T12:00:00.000Z"), 1, finMars)).toBe(true);
  });
});
