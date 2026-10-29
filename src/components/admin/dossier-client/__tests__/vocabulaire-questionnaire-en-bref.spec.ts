/**
 * Garde de vocabulaire du lot B10 : aucun mot banni dans un texte affiché ou envoyé par les
 * nouveaux fichiers du questionnaire en bref. Les commentaires sont retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/QuestionnaireEnBref.tsx",
  "src/features/dossier-client/fiche/questionnaire-en-bref.ts",
  "src/features/dossier-client/fiche/actions-relance-equipe.ts",
  "src/lib/email/templates/questionnaire-relance-equipe.tsx",
] as const;

const BANNIS: ReadonlyArray<RegExp> = [
  /\bprojets?\b(?!Id)/i,
  /Synthèse/i,
  /Échanges?/,
  /Rencontre/i,
  /\bGérer\b/,
  /Engagements?/,
  /Pénalités?/,
  /Échéance/i,
  /Probabilité/i,
  /Jamais ouvert/i,
  /certifi/i,
  /Qualiopi/,
  /Grenoble/i,
  /Aucun gain garanti/i,
  /dark:/,
];

describe("vocabulaire du questionnaire en bref (lot B10)", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot banni`, () => {
      const texte = lire(f);
      expect(BANNIS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }
});
