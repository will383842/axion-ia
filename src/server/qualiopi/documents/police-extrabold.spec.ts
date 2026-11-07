/**
 * V8-P1 — Manrope ExtraBold (800) disponible pour les PDF.
 * Le fichier OFL et sa licence sont livrés, et les deux enregistreurs
 * (production et filet de test) déclarent le poids 800.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { Document, Font, Page, Text, renderToBuffer } from "@react-pdf/renderer";

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

  it("produit réellement un PDF en poids 800 avec Manrope ExtraBold, sans erreur de police", async () => {
    const famille = "ManropeRenduTest800";
    Font.register({
      family: famille,
      fonts: [
        { src: path.join(process.cwd(), "public/fonts/Manrope-Regular.ttf"), fontWeight: 400 },
        { src: path.join(process.cwd(), "public/fonts/Manrope-ExtraBold.ttf"), fontWeight: 800 },
      ],
    });
    const doc = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", style: { fontFamily: famille, fontWeight: 800, padding: 40 } },
        React.createElement(Text, null, "Attestation de réalisation — poids 800"),
      ),
    );
    const pdf = await renderToBuffer(doc);
    expect(pdf.length).toBeGreaterThan(1_000);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
