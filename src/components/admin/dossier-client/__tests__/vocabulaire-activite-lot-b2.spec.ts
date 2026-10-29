/**
 * Garde de vocabulaire du lot B2 (onglet Activité, e-mails) : même contrôle que
 * `vocabulaire-des-fiches-clients.spec.ts`, sur les nouveaux fichiers d'affichage.
 * Les commentaires sont retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/OngletActivite.tsx",
  "src/components/admin/dossier-client/fiche/Chronologie.tsx",
  "src/components/admin/dossier-client/fiche/FiltresActivite.tsx",
  "src/components/admin/dossier-client/fiche/TuilesEmails.tsx",
  "src/components/admin/dossier-client/FilDesEchanges.tsx",
  "src/features/dossier-client/fiche/chronologie.ts",
  "src/features/dossier-client/fiche/lire-chronologie.ts",
] as const;

const INTERDITS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Échanges|Fil des échanges/, "Activité / Rendez-vous"],
  [/[Pp]rojets?\b(?!Id)/, "prestation"],
  [/Synthèse/, "Résumé"],
  [/Rencontre\b/, "Rendez-vous"],
  [/\bGérer\b|Engagements|Pénalités|Échéance|Probabilité|Jamais ouvert/, "mot banni"],
  [/certifi|Qualiopi|Grenoble|Aucun gain garanti/i, "mot banni"],
  [/\bdark:/, "console en thème clair"],
];

describe("vocabulaire du lot B2", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      const trouves = INTERDITS.filter(([re]) => re.test(texte)).map(
        ([re, bon]) => `${re} -> ${bon}`,
      );
      expect(trouves).toEqual([]);
    });
  }
  it("l'onglet s'appelle « Activité »", () => {
    expect(lire("src/components/admin/dossier-client/fiche/OngletActivite.tsx")).toContain(
      "Activité",
    );
  });
});
