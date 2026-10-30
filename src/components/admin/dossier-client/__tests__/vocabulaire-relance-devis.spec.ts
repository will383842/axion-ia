/**
 * Garde de vocabulaire du lot B9 (relance de devis) : aucun mot interdit dans les textes affichés
 * ni dans le brouillon d'e-mail. Les commentaires sont retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*(?:import|export)\b[^;]*?from\s+"[^"]*";/gm, "")
    .replace(/^\s*"(?:[^"]*\/)[^"]*",?$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/RelanceDevis.tsx",
  "src/features/dossier-client/fiche/relance-devis.ts",
  "src/features/dossier-client/fiche/actions-relance-devis.ts",
  "src/lib/email/templates/relance-devis-client.tsx",
] as const;

const INTERDITS: ReadonlyArray<RegExp> = [
  /\b[Pp]rojets?\b(?!Id)/,
  /Synthèse/,
  /Échanges?\b/,
  /Rencontre/,
  /\bGérer\b/,
  /Engagements?/,
  /Pénalités?/,
  /Échéance/,
  /Probabilité/,
  /Jamais ouvert/,
  /certifi/i,
  /\bQualiopi\b/,
  /grenoble/i,
  /gain garanti/i,
  /dark:/,
];

describe("vocabulaire de la relance de devis", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      const trouves = INTERDITS.filter((re) => re.test(texte)).map(String);
      expect(trouves).toEqual([]);
    });
  }
});
