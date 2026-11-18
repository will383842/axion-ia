/**
 * Garde de vocabulaire du lot B7 (devis et factures) : même contrôle que
 * `vocabulaire-des-fiches-clients.spec.ts`, sur les fichiers d'affichage du lot.
 * Les commentaires sont retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import[\s\S]*?from\s+"[^"]*";$/gm, "")
    .replace(/(?:href|from)=?\s*[{(]?`?"?[^\s"`]*\/qualiopi\/[^\s"`]*/g, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/OngletDevisFactures.tsx",
  "src/components/admin/dossier-client/fiche/TuilesArgent.tsx",
  "src/components/admin/dossier-client/fiche/CartesPieces.tsx",
  "src/features/dossier-client/fiche/argent-de-la-fiche.ts",
] as const;

const INTERDITS: readonly RegExp[] = [
  /\bprojets?\b/i,
  /Synthèse/i,
  /Échanges/,
  /Rencontre/i,
  /Gérer/,
  /Engagements?/,
  /Pénalités/i,
  /[ÉE]chéance/i,
  /Probabilité/,
  /Jamais ouvert/,
  /certifi[ée]|certification/i,
  /Qualiopi/i,
  /Grenoble/i,
  /Aucun gain garanti/i,
  /\bdark:/,
];

describe("vocabulaire du lot B7", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      expect(INTERDITS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }
});
