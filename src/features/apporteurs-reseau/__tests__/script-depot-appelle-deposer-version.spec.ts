import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "scripts/apporteurs/deposer-document-joint.ts"),
  "utf8",
);
// Code seul : les commentaires d'en-tête peuvent citer les mêmes noms.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("script de dépôt des annexes : il enregistre une version", () => {
  it("appelle deposerVersionAnnexe avec deposePar", () => {
    expect(code).toMatch(
      /deposerVersionAnnexe\(\s*doc\s*,\s*pdf\s*,\s*\{\s*deposePar: "script-deposer-document-joint"/,
    );
  });

  it("l'appelle AVANT tout retour anticipé « même sha256 »", () => {
    const appel = code.indexOf("deposerVersionAnnexe(doc");
    expect(appel).toBeGreaterThan(-1);
    const memeSha = code.indexOf("shaAncien === sha256");
    expect(memeSha === -1 || appel < memeSha).toBe(true);
    expect(code).not.toMatch(/déjà celui qui est déposé/);
  });

  it("l'essai à blanc revient avant tout accès base ou R2 d'écriture", () => {
    const blanc = code.indexOf("if (!appliquer)");
    expect(blanc).toBeGreaterThan(-1);
    const apres = code.slice(blanc);
    const avant = code.slice(0, blanc);
    expect(apres.indexOf("return;")).toBeLessThan(apres.indexOf("deposerVersionAnnexe"));
    // Dans main(), aucun accès R2 avant l'essai à blanc, hors liste sans identifiant.
    const main = avant.slice(avant.indexOf("async function main"));
    const sansListe = main.slice(main.indexOf("const doc = DOCUMENTS_ANNEXES.find"));
    expect(sansListe).not.toMatch(
      /enteteObjetR2|getObjectBufferR2|uploadToR2|isR2Configured|exigerR2/,
    );
  });

  it("n'écrit plus la clé fixe elle-même (deposerVersionAnnexe s'en charge)", () => {
    expect(code).not.toMatch(/uploadToR2\(\s*doc\.cleR2/);
  });

  it("l'en-tête décrit le retrait par retiree_at, plus la suppression de l'objet", () => {
    expect(source).toContain("retiree_at");
    expect(source).not.toMatch(/supprimer l'objet à sa\s+clé depuis/);
  });
});
