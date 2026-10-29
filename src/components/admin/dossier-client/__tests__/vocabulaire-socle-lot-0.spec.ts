/**
 * Glossaire unique (PLAN-PARCOURS-ET-VOCABULAIRE-CLIENTS.md §2), même contrôle que
 * `vocabulaire-des-fiches-clients.spec.ts`, pour les fichiers que le socle (lot 0) a déplacés ou créés :
 * Prestation (pas Projet), Rendez-vous (pas Rencontre ni Échanges), Résumé (pas Synthèse).
 * Les identifiants du code ne sont pas des textes ; les commentaires sont retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/OngletDevisFactures.tsx",
  "src/components/admin/dossier-client/fiche/Frise.tsx",
  "src/components/admin/dossier-client/fiche/ActionsDeLaPersonne.tsx",
] as const;

const ANCIENS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\b(?:[Nn]ouveau|[Aa]ucun|[Aa]utre|[Ss]ans) projet\b/,
    "Nouvelle / Aucune / Autre / Sans prestation",
  ],
  [/\b(?:ce|du|un|le|ton|votre|mon|même) projet\b/, "cette / de la / une / la prestation"],
  [/Quel projet|Projet évoqué|Projet \$\{|Projet :|Créer le projet|projets? évoqué/, "Prestation"],
  [/>Projets?</, "Prestations"],
  [/(?:^|[^\w-])[«"]Projets?[»"]/, "Prestations"],
  [/\bles projets\b/, "les prestations"],
  [/jamais rencontrée/, "jamais vue en rendez-vous"],
  [/cette rencontre\b/, "ce rendez-vous"],
  [/>Échanges</, "Rendez-vous"],
  [/"Synthèse"|La synthèse/, "Résumé"],
  [/Projet (?:créé|rouvert)/, "Prestation créée / rouverte"],
];

describe("vocabulaire du socle (lot 0)", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun ancien mot`, () => {
      const texte = lire(f);
      const trouves = ANCIENS.filter(([re]) => re.test(texte)).map(
        ([re, bon]) => `${re} -> ${bon}`,
      );
      expect(trouves).toEqual([]);
    });
  }
});
