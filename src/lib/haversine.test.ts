// Tests Haversine + travelBuffer — Sprint X.16.

import { describe, it, expect } from "vitest";
import {
  distanceKm,
  computeTravelBufferDays,
  distanceAndBufferFromHub,
  DEFAULT_HUB,
} from "./haversine";

describe("distanceKm", () => {
  it("Paris → Paris (identité) = 0", () => {
    expect(distanceKm(48.858844, 2.347625, 48.858844, 2.347625)).toBe(0);
  });

  it("Paris → Lyon ≈ 391 km (référence Wikipedia)", () => {
    const d = distanceKm(48.858844, 2.347625, 45.764043, 4.835659);
    expect(d).toBeGreaterThan(388);
    expect(d).toBeLessThan(395);
  });

  it("Paris → Marseille ≈ 660 km", () => {
    const d = distanceKm(48.858844, 2.347625, 43.296482, 5.36978);
    expect(d).toBeGreaterThan(657);
    expect(d).toBeLessThan(663);
  });

  it("Paris → Bordeaux ≈ 500 km", () => {
    const d = distanceKm(48.858844, 2.347625, 44.837789, -0.57918);
    expect(d).toBeGreaterThan(497);
    expect(d).toBeLessThan(505);
  });

  it("Paris → Versailles ≈ 17 km (banlieue)", () => {
    const d = distanceKm(48.858844, 2.347625, 48.804865, 2.120355);
    expect(d).toBeGreaterThan(15);
    expect(d).toBeLessThan(20);
  });

  it("Paris → Bruxelles ≈ 263 km", () => {
    const d = distanceKm(48.858844, 2.347625, 50.85045, 4.34878);
    expect(d).toBeGreaterThan(260);
    expect(d).toBeLessThan(268);
  });

  it("symétrie : d(A,B) === d(B,A)", () => {
    const a = distanceKm(48.85, 2.35, 45.76, 4.84);
    const b = distanceKm(45.76, 4.84, 48.85, 2.35);
    expect(a).toBe(b);
  });

  it("non-négatif", () => {
    expect(distanceKm(0, 0, 0, 0)).toBeGreaterThanOrEqual(0);
    expect(distanceKm(-50, -100, 50, 100)).toBeGreaterThan(0);
  });
});

describe("computeTravelBufferDays", () => {
  it("< 50 km → 0 jour", () => {
    expect(computeTravelBufferDays(0)).toBe(0);
    expect(computeTravelBufferDays(17)).toBe(0);
    expect(computeTravelBufferDays(49.9)).toBe(0);
  });

  it("[50, 500[ km → 0.5 jour", () => {
    expect(computeTravelBufferDays(50)).toBe(0.5);
    expect(computeTravelBufferDays(263)).toBe(0.5); // Bruxelles
    expect(computeTravelBufferDays(391)).toBe(0.5); // Lyon
    expect(computeTravelBufferDays(499.9)).toBe(0.5);
  });

  it(">= 500 km → 1 jour", () => {
    expect(computeTravelBufferDays(500)).toBe(1);
    expect(computeTravelBufferDays(660)).toBe(1); // Marseille
    expect(computeTravelBufferDays(2000)).toBe(1); // Madrid+
  });
});

describe("distanceAndBufferFromHub", () => {
  it("retourne distanceKm + travelBufferDays cohérents", () => {
    // Lyon depuis Paris (hub par défaut)
    const r = distanceAndBufferFromHub(45.764043, 4.835659);
    expect(r.distanceKm).toBeGreaterThan(388);
    expect(r.distanceKm).toBeLessThan(395);
    expect(r.travelBufferDays).toBe(0.5);
  });

  it("override hub custom (Lyon comme hub)", () => {
    const lyonHub = { lat: 45.764043, lng: 4.835659 };
    // Marseille depuis Lyon ≈ 280 km
    const r = distanceAndBufferFromHub(43.296482, 5.36978, lyonHub);
    expect(r.distanceKm).toBeGreaterThan(275);
    expect(r.distanceKm).toBeLessThan(285);
    expect(r.travelBufferDays).toBe(0.5);
  });

  it("default hub === Paris", () => {
    expect(DEFAULT_HUB.lat).toBeCloseTo(48.858844, 4);
    expect(DEFAULT_HUB.lng).toBeCloseTo(2.347625, 4);
    expect(DEFAULT_HUB.city).toBe("Paris");
  });

  it("Versailles depuis Paris → buffer 0 (banlieue)", () => {
    const r = distanceAndBufferFromHub(48.804865, 2.120355);
    expect(r.travelBufferDays).toBe(0);
  });

  it("Marseille depuis Paris → buffer 1 jour (> 500 km)", () => {
    const r = distanceAndBufferFromHub(43.296482, 5.36978);
    expect(r.travelBufferDays).toBe(1);
  });
});
