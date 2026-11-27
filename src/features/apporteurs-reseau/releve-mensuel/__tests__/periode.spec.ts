import { describe, expect, it } from "vitest";

import {
  bornesPeriode,
  debutAnnee,
  exigerPeriodeClose,
  moisPrecedent,
  niemeJourOuvre,
  periodeEstClose,
  periodePrecedente,
  periodeSuivante,
  periodeValide,
  premierJourOuvre,
} from "../periode";
import { estJourOuvreParis } from "../../autofacture-donnees";

const iso = (d: Date) => d.toISOString();

describe("bornesPeriode : mois civil de Paris", () => {
  it("été (UTC+2) : le 1er 00:00 Paris est la veille à 22:00 UTC", () => {
    const b = bornesPeriode("2026-06");
    expect(iso(b.debut)).toBe("2026-05-31T22:00:00.000Z");
    expect(iso(b.coupure)).toBe("2026-06-30T22:00:00.000Z");
  });

  it("hiver (UTC+1) : le 1er 00:00 Paris est la veille à 23:00 UTC", () => {
    const b = bornesPeriode("2026-01");
    expect(iso(b.debut)).toBe("2025-12-31T23:00:00.000Z");
    expect(iso(b.coupure)).toBe("2026-01-31T23:00:00.000Z");
  });

  it("passage à l'heure d'été (29 mars 2026) : mars dure 743 h", () => {
    const b = bornesPeriode("2026-03");
    expect(iso(b.debut)).toBe("2026-02-28T23:00:00.000Z");
    expect(iso(b.coupure)).toBe("2026-03-31T22:00:00.000Z");
    expect((b.coupure.getTime() - b.debut.getTime()) / 3_600_000).toBe(743);
  });

  it("passage à l'heure d'hiver (25 octobre 2026) : octobre dure 745 h", () => {
    const b = bornesPeriode("2026-10");
    expect(iso(b.debut)).toBe("2026-09-30T22:00:00.000Z");
    expect(iso(b.coupure)).toBe("2026-10-31T23:00:00.000Z");
    expect((b.coupure.getTime() - b.debut.getTime()) / 3_600_000).toBe(745);
  });

  it("changement d'année : la coupure de décembre est le 1er janvier 00:00 Paris", () => {
    expect(iso(bornesPeriode("2026-12").coupure)).toBe("2026-12-31T23:00:00.000Z");
    expect(iso(bornesPeriode("2027-01").debut)).toBe("2026-12-31T23:00:00.000Z");
  });

  it("refuse un format invalide", () => {
    for (const p of ["2026-13", "2026-00", "2026-1", "26-10", "2026/10", "", "2026-10-01"]) {
      expect(() => bornesPeriode(p)).toThrow();
    }
  });
});

describe("debutAnnee, periodeSuivante, periodePrecedente", () => {
  it("le cumul de l'année repart au 1er janvier 00:00 Paris", () => {
    expect(iso(debutAnnee("2026-10"))).toBe("2025-12-31T23:00:00.000Z");
    expect(iso(debutAnnee("2027-01"))).toBe("2026-12-31T23:00:00.000Z");
  });

  it("enjambe les années", () => {
    expect(periodeSuivante("2026-12")).toBe("2027-01");
    expect(periodePrecedente("2027-01")).toBe("2026-12");
    expect(periodeSuivante("2026-10")).toBe("2026-11");
    expect(periodePrecedente("2026-10")).toBe("2026-09");
  });

  it("periodeValide", () => {
    expect(periodeValide("2026-10")).toBe(true);
    expect(periodeValide("2026-13")).toBe(false);
    expect(periodeValide("abc")).toBe(false);
  });
});

describe("période close seulement", () => {
  it("moisPrecedent suit le jour de PARIS, pas celui d'UTC", () => {
    expect(moisPrecedent(new Date("2026-12-01T10:00:00Z"))).toBe("2026-11");
    // 23 h 30 UTC le 30 novembre = 00 h 30 Paris le 1er décembre
    expect(moisPrecedent(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    // 22 h 30 UTC le 30 novembre = 23 h 30 Paris : novembre n'est pas fini
    expect(moisPrecedent(new Date("2026-11-30T22:30:00Z"))).toBe("2026-10");
    expect(moisPrecedent(new Date("2027-01-02T10:00:00Z"))).toBe("2026-12");
  });

  it("periodeEstClose : jamais le mois en cours ni un mois futur", () => {
    const now = new Date("2026-12-01T10:00:00Z");
    expect(periodeEstClose("2026-11", now)).toBe(true);
    expect(periodeEstClose("2026-12", now)).toBe(false);
    expect(periodeEstClose("2027-01", now)).toBe(false);
    expect(periodeEstClose("2026-11", new Date("2026-11-30T22:30:00Z"))).toBe(false);
  });

  it("exigerPeriodeClose refuse côté serveur", () => {
    expect(() => exigerPeriodeClose("2026-12", new Date("2026-12-15T10:00:00Z"))).toThrow(
      /pas close/i,
    );
    expect(() => exigerPeriodeClose("2026-11", new Date("2026-12-15T10:00:00Z"))).not.toThrow();
  });
});

describe("Nᵉ jour ouvré (fériés compris)", () => {
  it("novembre 2026 : le 1er est un dimanche férié, le premier jour ouvré est le lundi 2", () => {
    expect(premierJourOuvre("2026-11")).toBe("2026-11-02");
  });

  it("mai 2026 : le 1er mai (vendredi) est férié, puis week-end", () => {
    expect(premierJourOuvre("2026-05")).toBe("2026-05-04");
    expect(niemeJourOuvre("2026-05", 2)).toBe("2026-05-05");
  });

  it("janvier 2027 : le 1er (vendredi) est férié", () => {
    expect(premierJourOuvre("2027-01")).toBe("2027-01-04");
  });

  it("n < 1 refusé", () => {
    expect(() => niemeJourOuvre("2026-11", 0)).toThrow();
  });
});

describe("estJourOuvreParis (helper extrait d'objectifVirement)", () => {
  it("lundi ouvré, samedi non, 1er mai non", () => {
    expect(estJourOuvreParis(new Date("2026-11-23T12:00:00Z"))).toBe(true);
    expect(estJourOuvreParis(new Date("2026-11-28T12:00:00Z"))).toBe(false);
    expect(estJourOuvreParis(new Date("2026-05-01T12:00:00Z"))).toBe(false);
  });

  it("suit le jour de Paris : vendredi 23 h 30 UTC est déjà samedi à Paris", () => {
    expect(estJourOuvreParis(new Date("2026-11-27T23:30:00Z"))).toBe(false);
  });
});
