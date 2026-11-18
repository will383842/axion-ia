/**
 * Garde de vocabulaire du lot A3 : aucun mot banni dans les textes affichés de la
 * carte de rendez-vous. Les commentaires sont retirés avant la lecture ; les
 * identifiants du code (`rencontre`, `data-rencontre`) ne sont pas des textes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/CarteRendezVous.tsx",
  "src/features/dossier-client/libelles-type-rendez-vous.ts",
] as const;

const BANNIS: ReadonlyArray<RegExp> = [
  /\bprojets?\b(?!Id)/i,
  /synth[èe]se/i,
  /[ÉE]changes/,
  /Rencontre\b(?!Type)/,
  /\bG[ée]rer\b/,
  /Engagements?/,
  /P[ée]nalit[ée]s?/,
  /[ÉE]ch[ée]ance/,
  /Probabilit[ée]/,
  /Jamais ouvert/,
  /certifi/i,
  /Qualiopi/i,
  /Grenoble/,
  /gain garanti/i,
  /dark:/,
];

describe("vocabulaire du lot A3 (rendez-vous)", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot banni`, () => {
      const texte = lire(f);
      expect(BANNIS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }
});
