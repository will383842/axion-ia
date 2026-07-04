import { describe, it, expect } from "vitest";
import { detectAnomalies, type AnomalySignals } from "./anomaly";

const T = { debitDropPct: 50, staleCellHours: 6, zeroResultAlert: true };
const OK: AnomalySignals = {
  debitCurrent: 100,
  debitPrevious: 100,
  zeroResultSources: [],
  staleCells: 0,
  quotaReached: 0,
};

describe("detectAnomalies", () => {
  it("rien d'anormal → aucune alerte", () => {
    expect(detectAnomalies(OK, T)).toEqual([]);
  });
  it("chute de débit ≥ seuil → alerte", () => {
    const a = detectAnomalies({ ...OK, debitCurrent: 40, debitPrevious: 100 }, T);
    expect(a.some((x) => x.type === "debit_drop")).toBe(true);
  });
  it("chute totale → critique", () => {
    const a = detectAnomalies({ ...OK, debitCurrent: 0, debitPrevious: 100 }, T);
    expect(a.find((x) => x.type === "debit_drop")?.severity).toBe("critical");
  });
  it("source à 0 anormal → alerte critique (incident type stub)", () => {
    const a = detectAnomalies({ ...OK, zeroResultSources: ["recherche_entreprises"] }, T);
    expect(a.find((x) => x.type === "zero_result")?.severity).toBe("critical");
  });
  it("cellules stale → alerte", () => {
    const a = detectAnomalies({ ...OK, staleCells: 3 }, T);
    expect(a.some((x) => x.type === "stale_cell")).toBe(true);
  });
  it("quota atteint → info", () => {
    const a = detectAnomalies({ ...OK, quotaReached: 2 }, T);
    expect(a.find((x) => x.type === "quota_reached")?.severity).toBe("info");
  });
});
