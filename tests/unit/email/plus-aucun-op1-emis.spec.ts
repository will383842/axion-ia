// Garde statique — plus aucun `op1` ne se fabrique hors de `opposition-jeton.ts`
// (plan « jeton op2 », J3).
//
// Tous les appelants passent par `jetonOpposition()` / `urlOpposition()`, qui décident du
// format derrière `OPPOSITION_JETON_V2`. Un fichier qui écrirait le littéral `op1` ou
// assemblerait un jeton à la main contournerait l'interrupteur : l'adresse repartirait
// lisible dans un lien, sans que rien ne le dise.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..", "..");
const SRC = join(RACINE, "src");
const AUTORISE = new Set(["src/server/email/opposition-jeton.ts"]);

function fichiers(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "node_modules" || nom === "__tests__") continue;
      fichiers(chemin, sortie);
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.(ts|tsx)$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

function sansCommentaires(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("aucun jeton d'opposition fabriqué à la main", () => {
  const cibles = fichiers(SRC)
    .map((f) => ({ f, rel: relative(RACINE, f).replaceAll("\\", "/") }))
    .filter(({ rel }) => !AUTORISE.has(rel));

  it("le littéral « op1 » n'apparaît dans aucun fichier de src/ (hors opposition-jeton.ts)", () => {
    const fautifs = cibles
      .filter(({ f }) => /["'`]op1[."'`]|op1\.\$\{/.test(sansCommentaires(readFileSync(f, "utf8"))))
      .map(({ rel }) => rel);
    expect(fautifs).toEqual([]);
  });

  it("aucun fichier n'assemble un jeton avec PREFIXE_JETON_OPPOSITION", () => {
    const fautifs = cibles
      .filter(({ f }) => {
        const code = sansCommentaires(readFileSync(f, "utf8"));
        // Un autre module peut avoir sa propre constante du même nom (audit-terrain) :
        // on ne regarde que les fichiers qui importent celle des e-mails.
        if (!/opposition-jeton|email\/opposition|from "\.\/opposition/.test(code)) return false;
        return (
          /PREFIXE_JETON_OPPOSITION(_V2)?\}?\s*\./.test(code) || /\$\{PREFIXE_JETON/.test(code)
        );
      })
      .map(({ rel }) => rel);
    expect(fautifs).toEqual([]);
  });
});
