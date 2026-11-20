import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Garde : la page publique « mémo Isère » ne parle plus de financement
// (OPCO, CPF, Qualiopi, France Travail, prise en charge). Les commentaires,
// les imports et l'identifiant du drapeau Qualiopi ne sont pas du texte affiché.
const FICHIER = join(process.cwd(), "src/app/[locale]/memo-isere/page.tsx");

function texteAffichable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/isQualiopiCertificationObtenue/g, "");
}

describe("page mémo Isère : aucune mention de financement affichée", () => {
  const texte = texteAffichable(readFileSync(FICHIER, "utf8"));
  const interdits: Array<[string, RegExp]> = [
    ["OPCO", /opco/i],
    ["Qualiopi", /qualiopi/i],
    ["CPF", /\bcpf\b/i],
    ["France Travail", /france\s+travail/i],
    ["prise en charge", /prise\s+en\s+charge/i],
    ["financement", /financ/i],
    ["Grenoble", /grenoble/i],
    ["Aucun gain garanti", /aucun gain garanti/i],
  ];
  it.each(interdits)("ne contient pas « %s »", (_nom, motif) => {
    expect(texte).not.toMatch(motif);
  });
});
