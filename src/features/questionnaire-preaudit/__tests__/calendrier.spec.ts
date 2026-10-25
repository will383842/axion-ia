/**
 * Calendrier des relances du questionnaire avant audit (2026-10-26) — `calendrier.ts`.
 * J+2, J+5, J+10 calendaires, reportés au jour ouvré, 9 h 30 Paris, strictement croissants ;
 * 3e relance avancée si l'audit est à moins de 24 h, sinon annulée.
 */

import { describe, expect, it } from "vitest";

import {
  dansCreneauRelance,
  estJourOuvreParis,
  feriesFrance,
  formaterAuditCourt,
  formaterAuditTexte,
  formaterJourMois,
  formaterProchaine,
  paques,
  planifierRelances,
  prochainCreneauRelance,
} from "../calendrier";

const iso = (d: Date | null) => (d === null ? null : d.toISOString());

describe("jours fériés et jours ouvrés", () => {
  it("Pâques (Butcher) et lundi de Pâques 2027 = 29/03", () => {
    expect(paques(2026)).toEqual({ mois: 4, jour: 5 });
    expect(paques(2027)).toEqual({ mois: 3, jour: 28 });
    expect(feriesFrance(2027).has("2027-03-29")).toBe(true);
    expect(feriesFrance(2026).has("2026-05-14")).toBe(true); // Ascension 2026
    expect(feriesFrance(2026).has("2026-05-25")).toBe(true); // lundi de Pentecôte 2026
    expect(feriesFrance(2026).size).toBe(11);
  });

  it("week-end et 11 novembre : non ouvrés", () => {
    expect(estJourOuvreParis("2026-10-31")).toBe(false); // samedi
    expect(estJourOuvreParis("2026-11-01")).toBe(false); // dimanche (et férié)
    expect(estJourOuvreParis("2026-11-11")).toBe(false); // mercredi férié
    expect(estJourOuvreParis("2026-11-02")).toBe(true);
  });
});

describe("planifierRelances", () => {
  it("J0 lundi 26/10/2026 10 h : 28/10, 02/11 (31/10 = samedi), 05/11, à 9 h 30 Paris", () => {
    const r = planifierRelances(new Date("2026-10-26T09:00:00Z"), null);
    expect(r.map((x) => iso(x.prevuLe))).toEqual([
      "2026-10-28T08:30:00.000Z",
      "2026-11-02T08:30:00.000Z",
      "2026-11-05T08:30:00.000Z",
    ]);
  });

  it("audit le 06/11 8 h 30 (Oury) : la 3e, à moins de 24 h, est avancée au 04/11 9 h 30", () => {
    const r = planifierRelances(new Date("2026-10-26T09:00:00Z"), new Date("2026-11-06T07:30:00Z"));
    expect(r.map((x) => iso(x.prevuLe))).toEqual([
      "2026-10-28T08:30:00.000Z",
      "2026-11-02T08:30:00.000Z",
      "2026-11-04T08:30:00.000Z",
    ]);
  });

  it("J0 dimanche 25/10 : 27/10, 30/10, 04/11", () => {
    const r = planifierRelances(new Date("2026-10-25T15:00:00Z"), null);
    expect(r.map((x) => iso(x.prevuLe))).toEqual([
      "2026-10-27T08:30:00.000Z",
      "2026-10-30T08:30:00.000Z",
      "2026-11-04T08:30:00.000Z",
    ]);
  });

  it("9 h 30 Paris = 08:30Z en heure d'hiver, 07:30Z en été", () => {
    const ete = planifierRelances(new Date("2026-06-01T08:00:00Z"), null);
    expect(iso(ete[0]?.prevuLe ?? null)).toBe("2026-06-03T07:30:00.000Z");
    const hiver = planifierRelances(new Date("2026-12-01T08:00:00Z"), null);
    expect(iso(hiver[0]?.prevuLe ?? null)).toBe("2026-12-03T08:30:00.000Z");
  });

  it("audit trop proche : les relances après la limite sont annulées, motif audit_proche", () => {
    const r = planifierRelances(new Date("2026-10-26T09:00:00Z"), new Date("2026-10-30T07:30:00Z"));
    expect(r[0]?.prevuLe).not.toBeNull();
    expect(r[1]).toEqual({ rang: 2, prevuLe: null, motif: "audit_proche" });
    expect(r[2]).toEqual({ rang: 3, prevuLe: null, motif: "audit_proche" });
  });

  it("toujours strictement croissant, toujours un jour ouvré, sur toute une année", () => {
    let d = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 366; i++) {
      const r = planifierRelances(d, null).map((x) => x.prevuLe as Date);
      expect(r[0]!.getTime()).toBeGreaterThan(d.getTime());
      expect(r[1]!.getTime()).toBeGreaterThan(r[0]!.getTime());
      expect(r[2]!.getTime()).toBeGreaterThan(r[1]!.getTime());
      d = new Date(d.getTime() + 24 * 3600 * 1000);
    }
  });
});

describe("textes et créneau", () => {
  it("formats français, heure de Paris", () => {
    const audit = new Date("2026-11-06T07:30:00Z");
    expect(formaterAuditTexte(audit)).toBe("vendredi 6 novembre à 8 h 30");
    expect(formaterAuditCourt(audit)).toBe("6 novembre");
    expect(formaterAuditTexte(new Date("2026-12-01T08:00:00Z"))).toBe("mardi 1er décembre à 9 h");
    expect(formaterJourMois(new Date("2026-11-04T08:30:00Z"))).toBe("04/11");
    expect(formaterProchaine(new Date("2026-11-04T08:30:00Z"))).toBe("mer. 4 nov. à 9 h 30");
  });

  it("rien le samedi, à 7 h, ni le 11/11 : report à 9 h 30 du prochain jour ouvré", () => {
    expect(dansCreneauRelance(new Date("2026-11-02T09:00:00Z"))).toBe(true); // lun 10 h
    expect(iso(prochainCreneauRelance(new Date("2026-10-31T09:00:00Z")))).toBe(
      "2026-11-02T08:30:00.000Z",
    );
    expect(iso(prochainCreneauRelance(new Date("2026-11-02T06:00:00Z")))).toBe(
      "2026-11-02T08:30:00.000Z",
    );
    expect(iso(prochainCreneauRelance(new Date("2026-11-11T09:00:00Z")))).toBe(
      "2026-11-12T08:30:00.000Z",
    );
    expect(iso(prochainCreneauRelance(new Date("2026-11-02T18:00:00Z")))).toBe(
      "2026-11-03T08:30:00.000Z",
    );
  });
});
