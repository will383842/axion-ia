/**
 * Tests — time.ts
 *
 * Vérifie :
 *   - formatMinutesToHHhMM : zéro, valeurs exactes, arrondis
 *   - parisDateISO : conversion UTC → date locale Paris (DST)
 *   - parisDateLabel : libellés lisibles par demi-journée
 */

import { describe, it, expect } from "vitest";
import { formatMinutesToHHhMM, parisDateISO, parisDateLabel } from "./time";

describe("formatMinutesToHHhMM", () => {
  it("0 → '0h00'", () => {
    expect(formatMinutesToHHhMM(0)).toBe("0h00");
  });

  it("45 → '0h45'", () => {
    expect(formatMinutesToHHhMM(45)).toBe("0h45");
  });

  it("60 → '1h00'", () => {
    expect(formatMinutesToHHhMM(60)).toBe("1h00");
  });

  it("423 → '7h03'", () => {
    expect(formatMinutesToHHhMM(423)).toBe("7h03");
  });

  it("210 → '3h30'", () => {
    expect(formatMinutesToHHhMM(210)).toBe("3h30");
  });

  it("valeur négative → '0h00'", () => {
    expect(formatMinutesToHHhMM(-10)).toBe("0h00");
  });
});

describe("parisDateISO", () => {
  it("retourne la date locale Paris (CEST UTC+2) pour un instant UTC de soirée", () => {
    // 2026-06-10T22:00:00Z = 2026-06-11T00:00:00+02:00 (CEST)
    const d = new Date("2026-06-10T22:00:00Z");
    expect(parisDateISO(d)).toBe("2026-06-11");
  });

  it("retourne la date locale Paris (CET UTC+1) en hiver", () => {
    // 2026-01-15T23:30:00Z = 2026-01-16T00:30:00+01:00 (CET)
    const d = new Date("2026-01-15T23:30:00Z");
    expect(parisDateISO(d)).toBe("2026-01-16");
  });

  it("heure UTC de matin → même date locale Paris", () => {
    const d = new Date("2026-06-10T08:00:00Z");
    expect(parisDateISO(d)).toBe("2026-06-10");
  });
});

describe("parisDateLabel", () => {
  it("matin → 'YYYY-MM-DD matin'", () => {
    expect(parisDateLabel("2026-06-10", "matin")).toBe("2026-06-10 matin");
  });

  it("apres_midi → 'YYYY-MM-DD après-midi'", () => {
    expect(parisDateLabel("2026-06-10", "apres_midi")).toBe("2026-06-10 après-midi");
  });

  it("journee → 'YYYY-MM-DD journée'", () => {
    expect(parisDateLabel("2026-06-10", "journee")).toBe("2026-06-10 journée");
  });
});
