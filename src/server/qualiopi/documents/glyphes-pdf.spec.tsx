/**
 * Tests de NON-RÉGRESSION — glyphes réellement imprimables dans les PDF.
 *
 * 🔴 Constaté et MESURÉ le 2026-07-26. Deux symptômes, une seule cause :
 *
 *   - tout montant ≥ 1 000 € sortait « 1/440,00 € » ;
 *   - la colonne « pièces à fournir » des 3 kits financeurs était VIDE.
 *
 * `Intl` fr-FR émet U+202F (fine insécable) comme séparateur de milliers depuis
 * CLDR 42, et les kits écrivaient « ☐ » (U+2610). Aucun de ces deux codepoints
 * n'existe dans les 8 polices de `public/fonts` — vérifié à fontkit,
 * `hasGlyphForCodePoint` faux partout, alors que U+00A0 est couvert 8/8.
 * @react-pdf bascule alors le fragment sur Helvetica en WinAnsiEncoding et
 * écrit l'octet de poids faible : 0x2F donne « / », 0x10 ne donne rien.
 *
 * POURQUOI 19 000 TESTS NE L'ONT JAMAIS VU — et c'est le vrai enseignement :
 * `collectPdfTextNormalized` fait `.replace(/\s+/g, " ")`, or en JavaScript
 * `\s` MATCHE U+202F (catégorie Unicode Zs). Le caractère fautif était donc
 * écrasé avant toute assertion. Les tests de ce fichier travaillent sur le
 * texte BRUT, jamais normalisé — sans quoi ils seraient aveugles eux aussi.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { formatEur, formatEurosFromCents, assainirEspacesPdf } from "./base-layout";
import { collectPdfText, collectPdfTextNormalized } from "./collect-pdf-text";

/** Codepoints qu'aucune police du projet ne couvre — donc interdits en PDF. */
const INTERDITS: ReadonlyArray<readonly [number, string]> = [
  [0x202f, "fine insécable (séparateur de milliers Intl fr-FR)"],
  [0x2009, "espace fine"],
  [0x2060, "gluon de mots"],
  [0x2610, "case à cocher vide"],
];

function codepointsInterdits(texte: string): string[] {
  const trouves: string[] = [];
  for (const [cp, nom] of INTERDITS) {
    if (texte.includes(String.fromCodePoint(cp))) {
      trouves.push(`U+${cp.toString(16).toUpperCase().padStart(4, "0")} — ${nom}`);
    }
  }
  return trouves;
}

describe("Formatage monétaire — le séparateur doit être imprimable", () => {
  // Le cas exact signalé par Will : « 1/440,00 € » sur le PDF du devis.
  it("1 440 € ne contient aucun codepoint absent des polices", () => {
    expect(codepointsInterdits(formatEur(1440))).toEqual([]);
  });

  it("le séparateur de milliers est bien une espace insécable ordinaire", () => {
    const rendu = formatEur(1440);
    expect(rendu.codePointAt(1)).toBe(0x00a0);
  });

  // Sans ce test, le précédent passerait aussi si le séparateur disparaissait.
  it("le séparateur n'est pas supprimé — « 1440,00 € » serait illisible", () => {
    expect(formatEur(1440)).toBe("1 440,00 €");
  });

  it("les montants sous le millier restent intacts", () => {
    expect(formatEur(999.5)).toBe("999,50 €");
  });

  it("le formatage depuis les centimes assainit aussi", () => {
    expect(codepointsInterdits(formatEurosFromCents(144000))).toEqual([]);
  });

  it("assainirEspacesPdf préserve le texte ordinaire", () => {
    expect(assainirEspacesPdf("Convention de formation")).toBe("Convention de formation");
  });
});

describe("Sources des templates — aucun glyphe non couvert en dur", () => {
  function fichiersDeRendu(): string[] {
    const racines = [
      path.join("src", "server", "qualiopi", "documents", "templates"),
      path.join("src", "server", "qualiopi", "supports", "templates"),
    ];
    const out: string[] = [];
    for (const racine of racines) {
      if (!fs.existsSync(racine)) continue;
      const pile = [racine];
      while (pile.length > 0) {
        const dir = pile.pop()!;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) pile.push(p);
          else if (/\.tsx?$/.test(e.name) && !/\.spec\.tsx?$/.test(e.name)) out.push(p);
        }
      }
    }
    return out;
  }

  // Les commentaires ont le droit de NOMMER le caractère fautif — c'est même ce
  // qui évitera la rechute. Seul le code rendu est interdit.
  function sansCommentaires(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  it("aucun template n'écrit un caractère que les polices ne peuvent pas rendre", () => {
    const coupables: string[] = [];
    for (const f of fichiersDeRendu()) {
      const trouves = codepointsInterdits(sansCommentaires(fs.readFileSync(f, "utf8")));
      if (trouves.length > 0) coupables.push(`${f} → ${trouves.join(", ")}`);
    }
    expect(coupables).toEqual([]);
  });

  it("le recensement trouve bien des templates — le garde-fou n'est pas vide", () => {
    expect(fichiersDeRendu().length).toBeGreaterThan(10);
  });
});

describe("collectPdfText — le texte BRUT, sinon le test est aveugle", () => {
  // Démonstration du piège, pour qu'il ne soit pas réintroduit : la version
  // normalisée efface la preuve. Tout test de glyphe doit utiliser `collectPdfText`.
  it("conserve les codepoints, contrairement à sa version normalisée", () => {
    const noeud = React.createElement("Text", null, "1 440,00 €");
    expect(collectPdfText(noeud)).toContain(" ");
    expect(collectPdfTextNormalized(noeud)).not.toContain(" ");
  });
});
