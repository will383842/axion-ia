/**
 * Garde de vocabulaire du lot B5 (carte de décision, départ d'une personne) : même contrôle que
 * `vocabulaire-des-fiches-clients.spec.ts`, commentaires retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/CarteDecision.tsx",
  "src/components/admin/dossier-client/fiche/BoutonDepart.tsx",
  "src/components/admin/dossier-client/fiche/PersonnesDecision.tsx",
  "src/components/admin/dossier-client/fiche/ActionsDeLaPersonne.tsx",
  "src/features/dossier-client/fiche/actions-depart.ts",
] as const;

const INTERDITS: ReadonlyArray<RegExp> = [
  /\bprojets?\b/i,
  /synthèse/i,
  /échanges?\b/i,
  /rencontre/i,
  /gérer/i,
  /engagements?\b/i,
  /pénalités?/i,
  /échéance/i,
  /probabilité/i,
  /jamais ouvert/i,
  /certifi/i,
  /qualiopi/i,
  /grenoble/i,
  /aucun gain garanti/i,
  /\bdark:/,
];

describe("vocabulaire du lot B5", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f)
        .replace(/^import .*$/gm, "")
        .replace(/\/qualiopi\//g, "/");
      expect(INTERDITS.filter((re) => re.test(texte)).map(String)).toEqual([]);
    });
  }
});
