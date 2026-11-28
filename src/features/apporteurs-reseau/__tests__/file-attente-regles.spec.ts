import { describe, expect, it } from "vitest";

import {
  ATTENTE_MAX_PAR_ENTREPRISE,
  EXTINCTION_ATTENTE_MOIS,
  FENETRE_PREMIER_RANG_JOURS,
  RANG_2_PROMU_AVEC_FENETRE,
  cleFile,
  eteinteLe,
  finFenetre,
  ordreDeFile,
  peutEntrerEnFile,
} from "../file-attente-regles";

describe("file d'attente — règles pures", () => {
  it("les constantes suivent les décisions de Will", () => {
    expect(ATTENTE_MAX_PAR_ENTREPRISE).toBe(2);
    expect(FENETRE_PREMIER_RANG_JOURS).toBe(15);
    expect(EXTINCTION_ATTENTE_MOIS).toBe(12);
    expect(RANG_2_PROMU_AVEC_FENETRE).toBe(false);
  });

  it("cleFile : le SIRET, sinon le SIREN", () => {
    expect(cleFile("123456782", "12345678200017")).toBe("12345678200017");
    expect(cleFile("123456782", null)).toBe("123456782");
  });

  it("ordreDeFile : l'horodatage, puis l'identifiant ; sans modifier l'entrée", () => {
    const l = [
      { id: "b", recueAt: new Date("2026-10-02T10:00:00Z") },
      { id: "c", recueAt: new Date("2026-10-01T10:00:00Z") },
      { id: "a", recueAt: new Date("2026-10-02T10:00:00Z") },
    ];
    expect(ordreDeFile(l).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(l.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("peutEntrerEnFile : moins de deux vivantes", () => {
    expect(peutEntrerEnFile(0)).toBe(true);
    expect(peutEntrerEnFile(1)).toBe(true);
    expect(peutEntrerEnFile(2)).toBe(false);
    expect(peutEntrerEnFile(3)).toBe(false);
  });

  it("finFenetre : 15 jours, fin du jour de Paris (hiver)", () => {
    // 10 déc. 2026 à 15 h Paris = jour 1 ; jour 15 = 24 déc. → 23:59:59.999 Paris (UTC+1).
    expect(finFenetre(new Date("2026-12-10T14:00:00Z")).toISOString()).toBe(
      "2026-12-24T22:59:59.999Z",
    );
  });

  it("finFenetre : 15 jours, fin du jour de Paris (été, UTC+2)", () => {
    expect(finFenetre(new Date("2026-07-10T12:00:00Z")).toISOString()).toBe(
      "2026-07-24T21:59:59.999Z",
    );
  });

  it("finFenetre : le changement d'heure de fin octobre ne décale pas la borne", () => {
    // jour 1 = 20 oct. (été) ; jour 15 = 3 nov. (hiver) → 23:59:59.999 Paris = 22:59:59.999Z.
    expect(finFenetre(new Date("2026-10-20T08:00:00Z")).toISOString()).toBe(
      "2026-11-03T22:59:59.999Z",
    );
  });

  it("eteinteLe : fin du jour de Paris, 12 mois après", () => {
    // 15 janv. 2026 → 15 janv. 2027, fin du jour (hiver).
    expect(eteinteLe(new Date("2026-01-15T09:00:00Z")).toISOString()).toBe(
      "2027-01-15T22:59:59.999Z",
    );
    // 31 mars 2026 + 12 mois = 31 mars 2027 (été) → 21:59:59.999Z.
    expect(eteinteLe(new Date("2026-03-31T09:00:00Z")).toISOString()).toBe(
      "2027-03-31T21:59:59.999Z",
    );
  });

  it("eteinteLe : ne tombe pas la veille (le 12e mois entier compte)", () => {
    const rec = new Date("2026-01-15T09:00:00Z");
    expect(eteinteLe(rec).getTime()).toBeGreaterThan(new Date("2027-01-15T09:00:00Z").getTime());
  });
});
