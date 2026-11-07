/**
 * V8-P1 — Manrope ExtraBold (800) disponible pour les PDF.
 * Le fichier OFL et sa licence sont livrés, et les deux enregistreurs
 * (production et filet de test) déclarent le poids 800.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("Manrope ExtraBold pour les PDF", () => {
  it("livre le TTF (en-tête TrueType) et la licence OFL", () => {
    const ttf = fs.readFileSync(path.join(process.cwd(), "public/fonts/Manrope-ExtraBold.ttf"));
    expect(ttf.length).toBeGreaterThan(10_000);
    expect([0x00010000, 0x74727565]).toContain(ttf.readUInt32BE(0));
    expect(lire("public/fonts/Manrope-OFL.txt")).toContain("SIL OPEN FONT LICENSE");
  });

  it("fonts.ts déclare le poids 800 sur la famille sans", () => {
    const src = lire("src/server/qualiopi/documents/fonts.ts");
    expect(src).toContain("Manrope-ExtraBold.ttf");
    expect(src).toMatch(/fontWeight:\s*800/);
  });

  it("le filet de test déclare aussi le poids 800", () => {
    expect(lire("src/server/qualiopi/documents/register-pdf-test-fonts.ts")).toMatch(
      /fontWeight:\s*800/,
    );
  });
});
