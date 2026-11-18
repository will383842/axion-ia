/**
 * Garde de vocabulaire du lot B8 (chances de signer, clôture prévue, frise) : aucun mot interdit
 * dans les textes affichés. Les commentaires sont retirés avant la lecture.
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
  "src/components/admin/dossier-client/SuiviPrestations.tsx",
  "src/components/admin/dossier-client/fiche/CartePrestationsResume.tsx",
  "src/components/admin/dossier-client/fiche/ResumePrestations.tsx",
  "src/features/dossier-client/fiche/affichage-prestation.ts",
  "src/features/dossier-client/fiche/pondere.ts",
] as const;

const INTERDITS: ReadonlyArray<RegExp> = [
  // Texte affiché seulement : « Projet » en majuscule ou le mot dans un texte entre guillemets (hors chemins et identifiants).
  /\bProjets?\b/,
  /"[^"/]*\bprojets?\b[^"/]*"/,
  />[^<>{}]*\bprojets?\b[^<>{}]*</,
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

describe("vocabulaire du lot B8", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      expect(INTERDITS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }
});
