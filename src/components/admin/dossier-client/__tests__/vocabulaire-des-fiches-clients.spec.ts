/**
 * Glossaire unique (PLAN-PARCOURS-ET-VOCABULAIRE-CLIENTS.md §2) : Prestation (pas Projet), Rendez-vous
 * (pas Rencontre ni Échanges), Résumé (pas Synthèse). Le test ROUGIT si un ancien mot revient dans un
 * texte affiché de la console des fiches clients. Les identifiants du code (`projetId`, `rencontres`,
 * `?onglet=projets`) ne sont pas des textes ; les commentaires sont retirés avant la lecture.
 * Le type « Rendez-vous projet » garde son mot (décision du glossaire) : il n'est pas dans ces fichiers.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ADMIN = "src/app/[locale]/(admin)/[adminPrefix]";
const FICHIERS = [
  "src/components/admin/dossier-client/Onglets.tsx",
  "src/components/admin/dossier-client/ApresLAppelVue.tsx",
  "src/components/admin/dossier-client/DocumentsDuProjet.tsx",
  "src/components/admin/dossier-client/FusionDeFiches.tsx",
  "src/components/admin/dossier-client/SuppressionManuelle.tsx",
  `${ADMIN}/qualiopi/clients/[id]/page.tsx`,
  `${ADMIN}/qualiopi/clients/[id]/projets/[projetId]/page.tsx`,
  "src/features/dossier-client/acces.ts",
  "src/features/dossier-client/defaire-fusion.ts",
  "src/features/dossier-client/deplacer.ts",
  "src/features/dossier-client/fusionner.ts",
  "src/features/dossier-client/note-manuelle.ts",
  "src/features/dossier-client/projets-evoques.ts",
  "src/features/dossier-client/valider.ts",
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

describe("vocabulaire des fiches clients", () => {
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
