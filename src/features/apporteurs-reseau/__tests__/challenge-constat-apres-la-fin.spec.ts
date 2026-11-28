import { describe, expect, it } from "vitest";

import { fenetreDeConstat, seuilAtteint } from "../challenge-regles";

// Lot I (#2464) : le constat n'a lieu qu'APRÈS la fin de la période.
const C = { finLe: "2026-12-31", paiementJusquAu: null as string | null };

describe("fenêtre de constat", () => {
  it("pendant la période : rien (y compris le dernier jour)", () => {
    expect(fenetreDeConstat(C, "2026-12-15")).toBe(false);
    expect(fenetreDeConstat(C, "2026-12-31")).toBe(false);
  });
  it("le lendemain de la fin : constat", () => {
    expect(fenetreDeConstat(C, "2027-01-01")).toBe(true);
  });
  it("sans date de paiement, la fenêtre se ferme au lendemain de la fin", () => {
    expect(fenetreDeConstat(C, "2027-01-02")).toBe(false);
  });
  it("avec paiementJusquAu, elle court jusqu'au lendemain de cette date", () => {
    const c = { ...C, paiementJusquAu: "2027-03-31" };
    expect(fenetreDeConstat(c, "2027-03-31")).toBe(true);
    expect(fenetreDeConstat(c, "2027-04-01")).toBe(true);
    expect(fenetreDeConstat(c, "2027-04-02")).toBe(false);
  });
});

describe("seuilAtteint", () => {
  it("10 → oui, 9 → non, 12 → oui (pas de palier)", () => {
    expect(seuilAtteint(10, 10)).toBe(true);
    expect(seuilAtteint(9, 10)).toBe(false);
    expect(seuilAtteint(12, 10)).toBe(true);
  });
});
