/**
 * Glossaire unique (PLAN-PARCOURS-ET-VOCABULAIRE-CLIENTS.md §2, 25/10/2026) : ce que Will lit dans la
 * console pour le questionnaire avant audit. Le test ROUGIT si un ancien mot revient dans les textes
 * affichés. Les identifiants du code (`relance_1`, `arreterRelances`...) ne sont pas des textes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Le fichier sans ses commentaires : seuls les TEXTES affichés comptent. */
const lire = (c: string): string =>
  readFileSync(join(process.cwd(), c), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FICHIERS = [
  "src/components/admin/dossier-client/QuestionnairePreaudit.tsx",
  "src/features/questionnaire-preaudit/libelles-courrier.ts",
  "src/features/questionnaire-preaudit/drapeaux-suivi.ts",
  "src/features/questionnaire-preaudit/config.ts",
  "src/features/questionnaire-preaudit/actions.ts",
] as const;

/** Anciens mots interdits dans les textes affichés (avec ce qu'il faut écrire à la place). */
const ANCIENS: ReadonlyArray<readonly [RegExp, string]> = [
  [/"Invitation"/, "Premier e-mail"],
  [/Relances?\s(?:\d|\{)/, "Rappel"],
  [/\brelances? (?:automatiques?|demandée|programmée|arrêtées?)/i, "rappel(s)"],
  [/Arrêter les relances/, "Arrêter les rappels"],
  [/\bM(?:'|&apos;)envoyer un essai/, "M'envoyer un test"],
  [/\[ESSAI\]/, "[TEST]"],
  [/Clore le questionnaire/, "Fermer le questionnaire"],
  [/questionnaire clos\b/, "fermé"],
  [/(?<![_\w])corbeille/i, "« E-mails à valider »"],
  [/pré-audit/i, "questionnaire avant audit"],
  [/"parti"|"retenu"|"échec"|"noté"/, "envoyé / en attente de votre validation / en erreur / enregistré"],
];

describe("vocabulaire du questionnaire avant audit", () => {
  for (const f of FICHIERS) {
    it(`${f} n'emploie aucun ancien mot`, () => {
      const texte = lire(f);
      const trouves = ANCIENS.filter(([re]) => re.test(texte)).map(([re, bon]) => `${re} -> ${bon}`);
      expect(trouves).toEqual([]);
    });
  }
});
