/**
 * Garde de vocabulaire du lot B1 (en-tête de la fiche). Les commentaires sont retirés avant la
 * lecture ; les identifiants du code ne sont pas des textes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/EnTeteFiche.tsx",
  "src/components/admin/dossier-client/fiche/CarteProchaineAction.tsx",
  "src/components/admin/dossier-client/fiche/TuilesFiche.tsx",
  "src/features/dossier-client/fiche/sante-du-compte.ts",
] as const;

const INTERDITS: ReadonlyArray<RegExp> = [
  /\bprojets?\b/i,
  /Synthèse/,
  /Échanges/,
  /\bRencontres?\b/,
  /\bGérer\b/,
  /Engagements/,
  /Pénalités/,
  /Échéance/,
  /Probabilité/,
  /Jamais ouvert/,
  /certifi/i,
  /Qualiopi/i,
  /Grenoble/i,
  /Aucun gain garanti/i,
  /\bdark:/,
];

describe("vocabulaire de l'en-tête de la fiche", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      expect(INTERDITS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }
});
