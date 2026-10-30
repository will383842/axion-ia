/**
 * Lot B6 — garde de vocabulaire du profil (responsable, étiquettes, archivage). Commentaires retirés avant lecture ; imite
 * `vocabulaire-des-fiches-clients.spec.ts` sans le modifier.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    // Identifiant du journal d'audit existant : du code, pas un texte affiché.
    .replace(/logQualiopiActivity/g, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/ProfilDeLaFiche.tsx",
  "src/components/admin/dossier-client/fiche/ArchivageFiche.tsx",
  "src/components/admin/dossier-client/fiche/FormulaireProfil.tsx",
  "src/features/dossier-client/fiche/profil.ts",
  "src/features/dossier-client/fiche/etiquettes.ts",
  "src/features/dossier-client/fiche/actions-profil.ts",
  "src/features/dossier-client/fiche/archivage-liste.ts",
] as const;

const INTERDITS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bprojets?\b/i, "prestation"],
  [/Synthèse/, "Résumé"],
  [/Échanges/, "Rendez-vous ou Activité"],
  [/Rencontre/, "rendez-vous"],
  [/\bGérer\b/, "—"],
  [/Engagements/, "—"],
  [/Pénalités/, "—"],
  [/Échéance/, "avant le …"],
  [/Probabilité/, "Chances de signer"],
  [/Jamais ouvert/, "Pas encore ouvert"],
  [/certifi/i, "—"],
  [/Grenoble/, "—"],
  [/Aucun gain garanti/, "—"],
  [/dark:/, "console en thème clair"],
  [/Qualiopi/, "—"],
];

describe("vocabulaire — profil et archivage (lot B6)", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      const trouves = INTERDITS.filter(([re]) => re.test(texte)).map(([re]) => String(re));
      expect(trouves).toEqual([]);
    });
  }
});
