/**
 * Sprint A-suite P6 — Item 4. Tests factCheckScore gate publication.
 * 3 scénarios :
 *  1. factCheckScore null → gate passé (non bloquant)
 *  2. factCheckScore 75 >= 40 (minScore) → gate passé
 *  3. factCheckScore 25 < 40 (minScore) + gate enabled → job quarantined_factcheck
 */

import { describe, it, expect } from "vitest";

interface FactCheckGateConfig {
  enabled: boolean;
  minScore: number;
}

/**
 * Logique pure du gate extraite du publish-worker pour test unitaire.
 * Retourne "quarantine" si le job doit être mis en quarantaine, "pass" sinon.
 */
function evaluateFactCheckGate(
  factCheckScore: number | null | undefined,
  gate: FactCheckGateConfig,
): "quarantine" | "pass" {
  if (
    gate.enabled &&
    factCheckScore !== null &&
    factCheckScore !== undefined &&
    factCheckScore < gate.minScore
  ) {
    return "quarantine";
  }
  return "pass";
}

describe("factCheckScore gate — Item 4 Sprint A-suite P6", () => {
  const gate: FactCheckGateConfig = { enabled: true, minScore: 40 };

  it("score null → pass (fact-check pas encore run)", () => {
    expect(evaluateFactCheckGate(null, gate)).toBe("pass");
  });

  it("score 75 >= 40 → pass", () => {
    expect(evaluateFactCheckGate(75, gate)).toBe("pass");
  });

  it("score 25 < 40 + gate enabled → quarantine", () => {
    expect(evaluateFactCheckGate(25, gate)).toBe("quarantine");
  });

  it("score 25 < 40 mais gate disabled → pass", () => {
    expect(evaluateFactCheckGate(25, { enabled: false, minScore: 40 })).toBe("pass");
  });

  it("score exactement égal au seuil (40 >= 40) → pass", () => {
    expect(evaluateFactCheckGate(40, gate)).toBe("pass");
  });
});
