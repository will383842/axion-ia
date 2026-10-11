/**
 * `haversineKm` vit dans un module SANS dépendance (lot L2c) : la console ne
 * doit pas charger le contenu SEO de `lib/geo.ts` pour une formule.
 * `lib/geo.ts` le ré-exporte : même fonction, aucun appelant ne change.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { haversineKm } from "../geo-distance";

describe("geo-distance", () => {
  it("Paris → Lyon ≈ 391 km", () => {
    const km = haversineKm({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 });
    expect(Math.round(km)).toBe(391);
  });

  it("même point → 0", () => {
    expect(haversineKm({ lat: 41.9, lon: 8.7 }, { lat: 41.9, lon: 8.7 })).toBe(0);
  });

  it("le module n'importe rien", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/geo-distance.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("lib/geo.ts ré-exporte la même fonction (une seule source)", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/geo.ts"), "utf8");
    expect(source).toMatch(/export\s*\{\s*haversineKm\s*\}\s*from\s*["']\.\/geo-distance["']/);
    expect(source).not.toMatch(/export function haversineKm/);
  });
});
