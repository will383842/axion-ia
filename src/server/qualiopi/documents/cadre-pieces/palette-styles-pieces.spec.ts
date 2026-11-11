import { describe, expect, it } from "vitest";
import { COULEURS_PIECES } from "@/lib/brand/couleurs-pieces";
import { pdfStylesPieces } from "@/server/qualiopi/documents/cadre-pieces/styles-blocs";

const COULEUR = /color$/i;

function couleurs(obj: unknown, acc: string[] = []): string[] {
  if (Array.isArray(obj)) obj.forEach((o) => couleurs(o, acc));
  else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string" && COULEUR.test(k)) acc.push(v);
      else couleurs(v, acc);
    }
  }
  return acc;
}

describe("pdfStylesPieces : palette", () => {
  it("toutes les couleurs sont dans la palette des pièces", () => {
    const palette = new Set<string>(Object.values(COULEURS_PIECES).map((c) => c.toLowerCase()));
    const toutes = couleurs(pdfStylesPieces);
    expect(toutes.length).toBeGreaterThan(10);
    for (const c of toutes) {
      expect(palette.has(c.toLowerCase()) || c === "transparent", c).toBe(true);
    }
  });
});
