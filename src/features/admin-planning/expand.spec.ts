/**
 * Tests — expand.ts (planning unifié).
 *
 * Le calendrier doit afficher une formation multi-jours sur CHAQUE case qu'elle
 * traverse, en Europe/Paris, sans dériver au passage à l'heure d'été.
 */

import { describe, it, expect } from "vitest";
import { expandEventDayKeys, nextDayKey, MAX_EVENT_DAYS } from "./expand";

/** Date à une heure donnée en UTC (les assertions raisonnent en heure de Paris). */
function utc(iso: string): Date {
  return new Date(iso);
}

describe("nextDayKey", () => {
  it("avance d'un jour", () => {
    expect(nextDayKey("2026-07-09")).toBe("2026-07-10");
  });

  it("franchit une fin de mois", () => {
    expect(nextDayKey("2026-07-31")).toBe("2026-08-01");
  });

  it("franchit une fin d'année", () => {
    expect(nextDayKey("2026-12-31")).toBe("2027-01-01");
  });

  it("gère le 29 février d'une année bissextile", () => {
    expect(nextDayKey("2028-02-28")).toBe("2028-02-29");
    expect(nextDayKey("2028-02-29")).toBe("2028-03-01");
  });
});

describe("expandEventDayKeys", () => {
  it("fin null → un seul jour", () => {
    expect(expandEventDayKeys(utc("2026-07-09T08:00:00Z"), null)).toEqual(["2026-07-09"]);
  });

  it("même jour → un seul jour", () => {
    expect(expandEventDayKeys(utc("2026-07-09T07:00:00Z"), utc("2026-07-09T15:00:00Z"))).toEqual([
      "2026-07-09",
    ]);
  });

  it("deux jours consécutifs → les deux cases", () => {
    expect(expandEventDayKeys(utc("2026-02-18T08:00:00Z"), utc("2026-02-19T16:00:00Z"))).toEqual([
      "2026-02-18",
      "2026-02-19",
    ]);
  });

  it("chevauche une fin de mois", () => {
    expect(expandEventDayKeys(utc("2026-07-30T08:00:00Z"), utc("2026-08-01T16:00:00Z"))).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
    ]);
  });

  it("chevauche une fin d'année", () => {
    expect(expandEventDayKeys(utc("2026-12-31T08:00:00Z"), utc("2027-01-01T16:00:00Z"))).toEqual([
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("fin antérieure au début (donnée incohérente) → un seul jour, sans throw", () => {
    expect(expandEventDayKeys(utc("2026-07-09T08:00:00Z"), utc("2026-07-01T08:00:00Z"))).toEqual([
      "2026-07-09",
    ]);
  });

  it("tronque au garde-fou maxDays", () => {
    const keys = expandEventDayKeys(utc("2026-01-01T08:00:00Z"), utc("2027-01-01T08:00:00Z"));
    expect(keys).toHaveLength(MAX_EVENT_DAYS);
    expect(keys[0]).toBe("2026-01-01");
  });

  it("respecte un maxDays explicite", () => {
    const keys = expandEventDayKeys(utc("2026-07-01T08:00:00Z"), utc("2026-07-31T08:00:00Z"), 3);
    expect(keys).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  // ── Fuseau Europe/Paris ────────────────────────────────────────────────────
  it("22h UTC en été compte pour le JOUR SUIVANT à Paris (UTC+2)", () => {
    // 2026-07-09T22:30Z = 2026-07-10T00:30 à Paris.
    expect(expandEventDayKeys(utc("2026-07-09T22:30:00Z"), null)).toEqual(["2026-07-10"]);
  });

  it("23h30 UTC en hiver compte pour le JOUR SUIVANT à Paris (UTC+1)", () => {
    // 2026-01-09T23:30Z = 2026-01-10T00:30 à Paris.
    expect(expandEventDayKeys(utc("2026-01-09T23:30:00Z"), null)).toEqual(["2026-01-10"]);
  });

  it("ne dérive pas au passage à l'heure d'été (dernier dimanche de mars)", () => {
    // Le 2026-03-29 la France passe à UTC+2 : ce jour parisien ne dure que 23 h.
    const keys = expandEventDayKeys(utc("2026-03-28T09:00:00Z"), utc("2026-03-30T09:00:00Z"));
    expect(keys).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
  });

  it("ne dérive pas au passage à l'heure d'hiver (dernier dimanche d'octobre)", () => {
    // Le 2026-10-25 la France repasse à UTC+1 : ce jour parisien dure 25 h.
    const keys = expandEventDayKeys(utc("2026-10-24T09:00:00Z"), utc("2026-10-26T09:00:00Z"));
    expect(keys).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });
});
