/**
 * Palette 2027 — le dossier de la page /journee-ia n'emploie ni dégradé, ni terracotta-deep
 * (décision D5 ouverte), ni utilitaire `white` en dur, ni graisse 800/900 (non chargée), ni hex :
 * tout passe par les jetons de globals.css.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = path.join(process.cwd(), "src/app/[locale]/journee-ia");

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const p = path.join(dir, nom);
    if (statSync(p).isDirectory()) return nom === "__tests__" ? [] : fichiers(p);
    return /\.(tsx?|css)$/.test(nom) ? [p] : [];
  });
}

const INTERDITS: Array<[string, RegExp]> = [
  ["dégradé", /gradient\(/],
  ["terracotta-deep", /terracotta-deep/],
  [
    "utilitaire white en dur",
    /(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|shadow)-white/,
  ],
  ["graisse extrabold/black", /font-(?:extrabold|black)/],
  ["graisse CSS 800/900", /font-weight:\s*(?:800|900)/],
  ["hex en dur", /#[0-9a-fA-F]{3,8}\b/],
];

describe("palette 2027 — dossier journee-ia", () => {
  const sources = fichiers(DOSSIER).map((p): [string, string] => [
    path.relative(DOSSIER, p),
    readFileSync(p, "utf8"),
  ]);

  it("trouve les fichiers de la page", () => {
    expect(sources.length).toBeGreaterThanOrEqual(6);
  });

  for (const [nom, motif] of INTERDITS) {
    it(`aucun(e) ${nom}`, () => {
      const fautifs = sources.filter(([, src]) => motif.test(src)).map(([f]) => f);
      expect(fautifs).toEqual([]);
    });
  }
});
