import { describe, expect, it } from "vitest";
import { finDeJourneeParis, lireJourIso, minuitParisUtc } from "./date-validite";

describe("date-validite", () => {
  it("fin de journée Paris : été (UTC+2) et hiver (UTC+1)", () => {
    expect(finDeJourneeParis(2026, 7, 15).toISOString()).toBe("2026-07-15T21:59:59.000Z");
    expect(finDeJourneeParis(2026, 12, 15).toISOString()).toBe("2026-12-15T22:59:59.000Z");
  });

  it("bascule d'heure de mars (jour de 23 h) et d'octobre (jour de 25 h)", () => {
    // 29 mars 2026 : passage à l'heure d'été à 2 h ; 23 h 59 min 59 s = 21 h 59 min 59 s UTC.
    expect(finDeJourneeParis(2026, 3, 29).toISOString()).toBe("2026-03-29T21:59:59.000Z");
    expect(finDeJourneeParis(2026, 3, 28).toISOString()).toBe("2026-03-28T22:59:59.000Z");
    // 25 octobre 2026 : retour à l'heure d'hiver ; 23 h 59 min 59 s = 22 h 59 min 59 s UTC.
    expect(finDeJourneeParis(2026, 10, 25).toISOString()).toBe("2026-10-25T22:59:59.000Z");
    expect(finDeJourneeParis(2026, 10, 24).toISOString()).toBe("2026-10-24T21:59:59.000Z");
  });

  it("minuitParisUtc : le jour civil de Paris, pas celui d'UTC", () => {
    // 23 h 30 UTC le 14 juillet = 1 h 30 le 15 à Paris.
    expect(minuitParisUtc(new Date("2026-07-14T23:30:00Z"))).toBe(Date.UTC(2026, 6, 15));
  });

  it("lireJourIso rejette 2026-02-30 et les formats faux", () => {
    expect(lireJourIso("2026-02-30")).toBeNull();
    expect(lireJourIso("2026-2-3")).toBeNull();
    expect(lireJourIso("2026-02-28")).toEqual({ y: 2026, mo: 2, d: 28 });
  });
});
