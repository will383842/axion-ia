/**
 * Lot A2 — garde de vocabulaire des fichiers d'affichage du formulaire « Modifier
 * la fiche ». Commentaires retirés avant lecture ; imite
 * `vocabulaire-des-fiches-clients.spec.ts` sans le modifier.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/qualiopi/ClientEditForm.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/edit/page.tsx",
  "src/components/admin/dossier-client/fiche/ProfilDeLaFiche.tsx",
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
];

describe("vocabulaire — Modifier la fiche (lot A2)", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f);
      const trouves = INTERDITS.filter(([re]) => re.test(texte)).map(([re]) => String(re));
      expect(trouves).toEqual([]);
    });
  }
});
