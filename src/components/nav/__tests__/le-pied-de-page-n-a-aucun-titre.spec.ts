/**
 * LE PIED DE PAGE N'INJECTE AUCUN TITRE h1-h6 DANS LES PAGES.
 *
 * Il ajoutait 4 h2 et 1 h3 à chaque page du site : la hiérarchie des titres
 * de chaque page était faussée. Les intertitres de colonnes sont des
 * paragraphes, et chaque liste est nommée par `aria-labelledby`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "src/components/nav/Footer.tsx"), "utf8");
// On ignore les commentaires pour ne tester que le balisage réel.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("pied de page : aucun titre", () => {
  it("ne contient aucune balise h1 à h6", () => {
    expect(code).not.toMatch(/<\/?h[1-6][\s>]/);
  });

  it("n'utilise pas de composant de titre ni role=heading", () => {
    expect(code).not.toMatch(/role=["']heading["']/);
    expect(code).not.toMatch(/\bas=["']h[1-6]["']/);
  });

  it("nomme chaque liste de liens par son intitulé visible", () => {
    expect(code).toMatch(/<ul[^>]*aria-labelledby=\{labelledBy\}/);
  });
});
