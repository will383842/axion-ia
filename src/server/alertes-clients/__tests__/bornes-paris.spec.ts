import { describe, it, expect } from "vitest";
import { bornesVeilleParis, jourParis } from "../bornes-paris";

describe("bornesVeilleParis", () => {
  it("été : la veille de Paris commence à 22:00 UTC (UTC+2)", () => {
    // 14 juillet 2026, 7 h 30 à Paris = 05:30 UTC.
    const b = bornesVeilleParis(new Date("2026-07-14T05:30:00Z"));
    expect(b.debut.toISOString()).toBe("2026-07-12T22:00:00.000Z");
    expect(b.fin.toISOString()).toBe("2026-07-13T22:00:00.000Z");
    expect(b.jour).toBe("2026-07-13");
    expect(b.jourCourt).toBe("13/07");
  });

  it("hiver : la veille de Paris commence à 23:00 UTC (UTC+1)", () => {
    const b = bornesVeilleParis(new Date("2026-11-14T06:30:00Z"));
    expect(b.debut.toISOString()).toBe("2026-11-12T23:00:00.000Z");
    expect(b.fin.toISOString()).toBe("2026-11-13T23:00:00.000Z");
    expect(b.jour).toBe("2026-11-13");
    expect(b.jourLong).toBe("13/11/2026");
  });

  it("passage à l'heure d'été (29/03/2026) : la veille dure 23 h, lue le lendemain", () => {
    // Le 29 mars Paris saute de 2 h à 3 h : ce jour-là fait 23 h.
    const b = bornesVeilleParis(new Date("2026-03-30T05:30:00Z"));
    expect(b.debut.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(b.fin.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect((b.fin.getTime() - b.debut.getTime()) / 3600_000).toBe(23);
  });

  it("retour à l'heure d'hiver (25/10/2026) : la veille dure 25 h", () => {
    const b = bornesVeilleParis(new Date("2026-10-26T06:30:00Z"));
    expect(b.debut.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(b.fin.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect((b.fin.getTime() - b.debut.getTime()) / 3600_000).toBe(25);
  });

  it("à 23 h 30 UTC l'été, Paris est déjà le lendemain : la veille avance d'un jour", () => {
    const b = bornesVeilleParis(new Date("2026-07-13T22:30:00Z")); // 00:30 le 14 à Paris
    expect(b.jour).toBe("2026-07-13");
    expect(jourParis(new Date("2026-07-13T22:30:00Z"))).toBe("2026-07-14");
  });

  it("passe le 1er janvier : la veille est le 31 décembre", () => {
    const b = bornesVeilleParis(new Date("2027-01-01T06:30:00Z"));
    expect(b.jour).toBe("2026-12-31");
    expect(b.jourCourt).toBe("31/12");
  });
});
