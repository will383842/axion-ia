/**
 * Garde de vocabulaire du lot B3 (tâches) : même contrôle que `vocabulaire-personnes-decision.spec.ts`,
 * commentaires retirés avant la lecture.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/fiche/CarteTaches.tsx",
  "src/components/admin/dossier-client/fiche/ResumeTaches.tsx",
  "src/features/dossier-client/fiche/actions-taches.ts",
  "src/features/dossier-client/fiche/taches.ts",
] as const;

const INTERDITS: ReadonlyArray<RegExp> = [
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

/** « projet » reste le nom technique de la table : seuls les TEXTES affichés sont jugés. */
function textesAffiches(source: string): string {
  const sansCode = source.replace(/\$\{[^}]*\}/g, "");
  const litteraux = sansCode.match(/"[^"\n]*"|`[^`]*`/g) ?? [];
  const jsx = sansCode.match(/>[^<>{}\n]+</g) ?? [];
  return [...litteraux.filter((l) => l !== '"projet"'), ...jsx].join("\n");
}

describe("vocabulaire du lot B3", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun mot interdit`, () => {
      const texte = lire(f)
        .replace(/^import .*$/gm, "")
        .replace(/\/qualiopi\//g, "/")
        .replace(/@\/server\/actions\/qualiopi\/_guards/g, "")
        .replace(/logQualiopiActivity/g, "");
      expect(INTERDITS.filter((re) => re.test(texte)).map(String)).toEqual([]);
      expect(/\bprojets?\b/i.test(textesAffiches(texte))).toBe(false);
    });
  }
});
