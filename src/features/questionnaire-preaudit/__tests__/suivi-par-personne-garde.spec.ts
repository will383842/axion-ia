/**
 * CLIQUET NOMINATIF — le suivi par personne et la copie complète LISENT, rien d'autre (2026-10-27).
 *
 *   · `squelette.ts`, `personnes.ts`, `suivi-par-personne.ts` et `export-complet.ts` n'écrivent dans
 *     aucune table `questionnaireAvantAudit*` (ni create, update, upsert, delete), n'envoient rien
 *     et ne journalisent rien (ni `console.`, ni logger) : le contenu des réponses ne sert qu'à
 *     COMPTER ;
 *   · les modules « purs » n'importent ni la base ni la file d'envoi ;
 *   · `export-complet.ts` n'écrit même pas dans `activityLog` : la trace est écrite par sa route,
 *     avant de rendre quoi que ce soit, et c'est le seul écrivain de cette action ;
 *   · l'export reste éteint tant que `QUESTIONNAIRE_EXPORT_COMPLET_ENABLED` n'est pas exactement "true".
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { exportCompletActif } from "../export-complet";

const RACINE = path.resolve(__dirname, "../../../..");
const lire = (rel: string): string =>
  readFileSync(path.join(RACINE, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const LECTEURS = [
  "src/features/questionnaire-preaudit/squelette.ts",
  "src/features/questionnaire-preaudit/personnes.ts",
  "src/features/questionnaire-preaudit/suivi-par-personne.ts",
  "src/features/questionnaire-preaudit/export-complet.ts",
] as const;

const ROUTE =
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/questionnaire/export/route.ts";

describe("le suivi par personne ne fait que lire", () => {
  for (const f of LECTEURS) {
    it(`${f} n'écrit dans aucune table du questionnaire`, () => {
      expect(lire(f)).not.toMatch(
        /questionnaireAvantAudit\w*\s*\.\s*(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/,
      );
      expect(lire(f)).not.toMatch(/\$(executeRaw|queryRaw)/);
    });
    it(`${f} ne journalise rien et n'envoie rien`, () => {
      const s = lire(f);
      expect(s).not.toMatch(/\bconsole\s*\./);
      expect(s).not.toMatch(/\blogger\b|\bpino\b|\bSentry\b/);
      expect(s).not.toMatch(/enqueueEmail|envoyerQuestionnaire|sendEmail/);
    });
  }

  it("squelette.ts et personnes.ts sont purs : ni base, ni chiffrement", () => {
    for (const f of [LECTEURS[0], LECTEURS[1]]) {
      const s = lire(f);
      expect(s).not.toMatch(/@\/lib\/prisma|chiffrer-parole|node:fs/);
    }
  });

  it("SuiviParPersonne.tsx : le lien « Écrire » est un mailto, aucun envoi ni action serveur", () => {
    const s = lire("src/components/admin/dossier-client/SuiviParPersonne.tsx");
    expect(s).toContain("mailto:");
    expect(s).not.toMatch(/enqueueEmail|envoyerQuestionnaire|sendEmail|<form|fetch\(/);
    expect(s).not.toMatch(/console\s*\./);
  });

  it("export-complet.ts n'écrit même pas dans activityLog", () => {
    expect(lire("src/features/questionnaire-preaudit/export-complet.ts")).not.toMatch(
      /activityLog/,
    );
  });

  it("la route d'export écrit sa trace AVANT de rendre la copie, et n'écrit que cela", () => {
    const s = lire(ROUTE);
    expect(s.match(/\.(create|update|upsert|delete)\w*\(/g)).toEqual([".create("]);
    expect(s.indexOf("activityLog.create")).toBeGreaterThan(0);
    expect(s.indexOf("activityLog.create")).toBeLessThan(s.indexOf("new NextResponse(JSON"));
    expect(s).not.toMatch(/questionnaireAvantAudit\w*\s*\.\s*(create|update|upsert|delete)/);
    expect(s).not.toMatch(/\bconsole\s*\./);
  });
});

describe("l'export complet est éteint par défaut", () => {
  it("absent, vide ou autre valeur que true : éteint", () => {
    expect(exportCompletActif({})).toBe(false);
    for (const v of ["", "false", "1", "TRUE", "True", " true"]) {
      expect(exportCompletActif({ QUESTIONNAIRE_EXPORT_COMPLET_ENABLED: v })).toBe(false);
    }
    expect(exportCompletActif({ QUESTIONNAIRE_EXPORT_COMPLET_ENABLED: "true" })).toBe(true);
  });
  it("déclaré dans env.ts (deux endroits), le workflow des drapeaux et .env.example", () => {
    const env = lire("src/env.ts");
    expect(env.match(/^\s*QUESTIONNAIRE_EXPORT_COMPLET_ENABLED:/gm)).toHaveLength(2);
    expect(lire(".github/workflows/coolify-drapeau.yml")).toContain(
      "QUESTIONNAIRE_EXPORT_COMPLET_ENABLED",
    );
    expect(readFileSync(path.join(RACINE, ".env.example"), "utf8")).toContain(
      "QUESTIONNAIRE_EXPORT_COMPLET_ENABLED",
    );
  });
});
