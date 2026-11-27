import { describe, expect, it } from "vitest";
import { borneBasseWilson, borneHauteWilson } from "../wilson";

describe("Wilson", () => {
  it("0 clic sur 40 : la borne haute (~6,3 %) ne passe pas sous 0,6 × 10 %", () => {
    const haute = borneHauteWilson(0, 40);
    expect(haute).toBeGreaterThan(0.06);
    expect(haute).toBeLessThan(0.07);
    expect(haute < 0.6 * 0.1).toBe(false);
  });
  it("encadre la proportion observée", () => {
    expect(borneBasseWilson(50, 500)).toBeLessThan(0.1);
    expect(borneHauteWilson(50, 500)).toBeGreaterThan(0.1);
  });
  it("rend 0 / 1 sans impression au lieu de NaN", () => {
    expect(borneBasseWilson(0, 0)).toBe(0);
    expect(borneHauteWilson(0, 0)).toBe(1);
  });
  it("borne les clics supérieurs aux impressions", () => {
    expect(borneHauteWilson(60, 50)).toBeLessThanOrEqual(1);
  });
});
