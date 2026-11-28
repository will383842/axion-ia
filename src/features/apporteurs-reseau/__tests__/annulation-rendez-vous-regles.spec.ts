import { describe, expect, it } from "vitest";

import {
  JOURS_REPORT_APRES_ANNULATION,
  annulationRetientEncore,
  echeanceQualification,
} from "../annulation-rendez-vous-regles";

// Constaté le mardi 1er décembre 2026 à 11 h (Paris) : le 15e jour se termine le 15/12 à 23:59:59.999 (Paris, UTC+1).
const CONSTATEE = new Date("2026-12-01T10:00:00Z");
const DERNIER_INSTANT = new Date("2026-12-15T22:59:59.999Z");

describe("annulationRetientEncore (contrat 2.8, art. 3.2)", () => {
  it("le délai de report est de 15 jours", () => {
    expect(JOURS_REPORT_APRES_ANNULATION).toBe(15);
  });

  it("non qualifiée : retient toujours, même très tard (la Société ne profite pas de son inaction)", () => {
    expect(
      annulationRetientEncore({
        auteur: null,
        constateeAt: CONSTATEE,
        reportCle: null,
        maintenant: new Date("2027-06-01T10:00:00Z"),
      }),
    ).toBe(true);
  });

  it("annulée par Axion : retient (elle sera réputée tenue)", () => {
    expect(
      annulationRetientEncore({
        auteur: "axion",
        constateeAt: CONSTATEE,
        reportCle: null,
        maintenant: new Date("2027-06-01T10:00:00Z"),
      }),
    ).toBe(true);
  });

  it("entreprise avec report convenu : retient, quelle que soit la date", () => {
    expect(
      annulationRetientEncore({
        auteur: "entreprise",
        constateeAt: CONSTATEE,
        reportCle: "calendly:abc",
        maintenant: new Date("2027-06-01T10:00:00Z"),
      }),
    ).toBe(true);
  });

  it("entreprise sans report : retient jusqu'au 15e jour inclus à 23:59:59.999 (Paris)", () => {
    const base = { auteur: "entreprise" as const, constateeAt: CONSTATEE, reportCle: null };
    expect(annulationRetientEncore({ ...base, maintenant: CONSTATEE })).toBe(true);
    expect(annulationRetientEncore({ ...base, maintenant: DERNIER_INSTANT })).toBe(true);
  });

  it("entreprise sans report : ne retient plus dès le lendemain 00:00 (Paris)", () => {
    expect(
      annulationRetientEncore({
        auteur: "entreprise",
        constateeAt: CONSTATEE,
        reportCle: null,
        maintenant: new Date(DERNIER_INSTANT.getTime() + 1),
      }),
    ).toBe(false);
  });
});

describe("echeanceQualification", () => {
  it("alerte à 5 jours ouvrés, critique à 10 jours ouvrés", () => {
    const e = echeanceQualification(CONSTATEE); // mardi 1/12
    expect(e.alerte.getTime()).toBeGreaterThan(CONSTATEE.getTime());
    expect(e.critique.getTime()).toBeGreaterThan(e.alerte.getTime());
    // mardi 1/12 + 5 jours ouvrés = mardi 8/12 ; + 10 = mardi 15/12
    expect(e.alerte.toISOString().slice(0, 10)).toBe("2026-12-08");
    expect(e.critique.toISOString().slice(0, 10)).toBe("2026-12-15");
  });
});
