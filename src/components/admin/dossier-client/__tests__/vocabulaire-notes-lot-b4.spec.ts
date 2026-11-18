/**
 * Garde de vocabulaire du lot B4 (notes) : aucun mot interdit dans les textes affichés
 * (commentaires retirés avant lecture).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // Un chemin de route n'est pas un texte affiché.
    .replace(/\/qualiopi\/clients/g, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/CarteNotes.tsx",
  "src/components/admin/dossier-client/fiche/ResumeNotes.tsx",
  "src/features/dossier-client/fiche/notes.ts",
  "src/features/dossier-client/fiche/actions-notes.ts",
] as const;

const INTERDITS: ReadonlyArray<RegExp> = [
  /\b(?:ce|du|un|le|une|la|cette|nouveau|nouvelle|aucun|aucune) projet\b/i,
  />Projets?</,
  /Synthèse/,
  /Échanges/,
  /Rencontre/,
  /\bGérer\b/,
  /Engagements|Pénalités|Échéance|Probabilité|Jamais ouvert/,
  /certifi|Qualiopi|Grenoble|Aucun gain garanti/i,
  /dark:/,
];

describe("vocabulaire des notes (lot B4)", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      expect(INTERDITS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }

  it("ne supprime jamais une note", () => {
    for (const f of FICHIERS) expect(lire(f)).not.toMatch(/\.delete(?:Many)?\(/);
  });
});
