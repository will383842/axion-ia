/**
 * Gardes de structure du questionnaire de pré-audit (2026-10-24) :
 *   · la migration est ré-exécutable (aucun `ADD CONSTRAINT` nu) ;
 *   · les en-têtes de `next.config.ts` sont ceux de `entetes.ts` (bac à sable) ;
 *   · AUCUNE suppression automatique (conservation 5 ans, décision de Will du 25/10) ;
 *   · le jeton du pré-audit a son propre domaine HMAC ;
 *   · l'export et l'effacement passent par la portée « dirigeant seul ».
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { jetonPreaudit, jetonPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { jetonQuestionnaire, jetonValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { RETENTION_ANS } from "../config";
import { CSP_PAGE_PREAUDIT } from "../entetes";
import { envoisDuDirigeant } from "../portee-rgpd";

const RACINE = path.resolve(__dirname, "../../../..");
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

describe("la migration est ré-exécutable", () => {
  const sql = lire("prisma/migrations/20261024120000_questionnaire_avant_audit/migration.sql");

  it("aucune création sans garde, aucun ADD CONSTRAINT hors d'un bloc gardé", () => {
    expect(sql).not.toMatch(/CREATE TABLE (?!IF NOT EXISTS)/);
    expect(sql).not.toMatch(/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/);
    const lignes = sql.split("\n");
    lignes.forEach((l, i) => {
      if (!/ADD CONSTRAINT/.test(l)) return;
      const avant = lignes.slice(Math.max(0, i - 4), i).join("\n");
      expect(avant, `ADD CONSTRAINT ligne ${i + 1} sans garde pg_constraint`).toMatch(
        /IF NOT EXISTS \(SELECT 1 FROM pg_constraint/,
      );
    });
  });

  it("ne touche à aucune table existante (additive)", () => {
    expect(sql).not.toMatch(
      /\b(DROP|DELETE|TRUNCATE)\b(?![^\n]*--)(?!.*Retour arrière)/i.source
        ? /^(?!--).*\b(DROP|TRUNCATE|DELETE FROM)\b/m
        : /x/,
    );
  });
});

describe("les en-têtes de next.config.ts sont ceux du bac à sable", () => {
  it("la règle /questionnaire/preaudit pose la même CSP, après /questionnaire/:path*", () => {
    const cfg = lire("next.config.ts");
    const iGeneral = cfg.indexOf('source: "/questionnaire/:path*"');
    const iPreaudit = cfg.indexOf('source: "/questionnaire/preaudit/:path*"');
    expect(iGeneral).toBeGreaterThan(0);
    expect(iPreaudit).toBeGreaterThan(iGeneral);
    const bloc = cfg.slice(iPreaudit, cfg.indexOf("// Dossier en ligne d'un apporteur", iPreaudit));
    const directives = [...bloc.matchAll(/^\s+"([^"]+)",?$/gm)].map((m) => m[1]);
    expect(directives.join("; ")).toBe(CSP_PAGE_PREAUDIT);
    expect(bloc).toContain('"no-referrer"');
  });

  it("jamais allow-same-origin", () => {
    expect(CSP_PAGE_PREAUDIT).not.toContain("allow-same-origin");
    expect(CSP_PAGE_PREAUDIT.startsWith("sandbox allow-scripts allow-forms")).toBe(true);
  });
});

function sources(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === "generated" || nom === "__tests__") continue;
    const p = path.join(dossier, nom);
    if (statSync(p).isDirectory()) sources(p, sortie);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(nom) && !/\.(spec|test)\.[cm]?[jt]sx?$/.test(nom))
      sortie.push(p);
  }
  return sortie;
}

describe("conservation 5 ans : AUCUNE suppression automatique (décision de Will, 25/10)", () => {
  const rel = (p: string) => path.relative(RACINE, p).replace(/\\/g, "/");
  // `src/` ET `scripts/` : un script lancé à la main ou par une tâche planifiée compte aussi.
  const tous = () => [
    ...sources(path.join(RACINE, "src")),
    ...sources(path.join(RACINE, "scripts")),
  ];
  // `.delete(`, `.deleteMany(` (client Prisma, transaction comprise) ET le SQL brut.
  const TABLES = new RegExp(
    [
      /questionnaireAvantAudit(Envoi|Brouillon)?\s*\.\s*delete(Many)?\s*\(/.source,
      /DELETE\s+FROM\s+"?questionnaires_avant_audit/.source,
    ].join("|"),
    "i",
  );

  it("le motif voit les trois formes de suppression", () => {
    expect(TABLES.test("tx.questionnaireAvantAudit.delete({")).toBe(true);
    expect(TABLES.test("prisma.questionnaireAvantAuditEnvoi .deleteMany(")).toBe(true);
    expect(TABLES.test("prisma.questionnaireAvantAuditBrouillon.delete (")).toBe(true);
    expect(TABLES.test('DELETE FROM "questionnaires_avant_audit_envois"')).toBe(true);
    expect(TABLES.test("delete from questionnaires_avant_audit_brouillons")).toBe(true);
    expect(TABLES.test("prisma.questionnaireAvantAudit.findMany(")).toBe(false);
  });

  it("la conservation vaut 5 ans", () => {
    expect(RETENTION_ANS).toBe(5);
  });

  it("aucune fonction de purge n'existe plus (réponses, envois, brouillons)", () => {
    const avecPurge = tous()
      .filter((p) =>
        /purgerReponsesAnciennes|purgerBrouillonsInactifs|PURGE_PLANIFIEE/.test(
          readFileSync(p, "utf8"),
        ),
      )
      .map(rel);
    expect(avecPurge).toEqual([]);
  });

  it("le worker, les tâches planifiées et les routes cron ne suppriment rien de ces tables", () => {
    const planifies = tous()
      .map(rel)
      .filter((p) => p.startsWith("src/server/queue/") || p.includes("/cron/"))
      .filter((p) =>
        /questionnaireAvantAudit|questionnaires_avant_audit/.test(
          readFileSync(path.join(RACINE, p), "utf8"),
        ),
      );
    expect(planifies).toEqual([]);
  });

  it("seuls des gestes de personnes suppriment (cliquet nominatif)", () => {
    // envoi réussi (brouillon de la personne), retrait de son accord (DELETE), redépôt de Will
    // (questionnaire jamais envoyé), effacement RGPD de Will.
    const AUTORISES = [
      "src/features/questionnaire-preaudit/brouillon.ts",
      "src/features/questionnaire-preaudit/serveur.ts",
      "src/lib/rgpd-erase.ts",
    ];
    const ecrivains = tous()
      .filter((p) => TABLES.test(readFileSync(p, "utf8")))
      .map(rel)
      .sort();
    expect(ecrivains.filter((p) => !AUTORISES.includes(p))).toEqual([]);
  });
});

describe("le jeton du pré-audit", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("a son propre domaine : le jeton de cadrage n'ouvre pas un pré-audit, et inversement", () => {
    const pre = jetonPreaudit(id) as string;
    const cad = jetonQuestionnaire(id) as string;
    expect(pre).not.toBe(cad);
    expect(jetonPreauditValide(id, pre)).toBe(true);
    expect(jetonPreauditValide(id, cad)).toBe(false);
    expect(jetonValide(id, pre)).toBe(false);
  });
});

describe("export et effacement : le dirigeant seul", () => {
  it("la portée exclut les salariés et le référent informatique", () => {
    const w = envoisDuDirigeant("a@b.fr", "h");
    expect(w.mode).toBe("main");
    expect(envoisDuDirigeant("a@b.fr", null).questionnaire.OR).toHaveLength(1);
  });
  it("l'export et l'effacement utilisent cette portée", () => {
    expect(lire("src/lib/rgpd-dossier-client.ts")).toContain("envoisDuDirigeant(email, empreinte)");
    expect(lire("src/lib/rgpd-erase.ts")).toContain("envoisDuDirigeant(email, empreintePreaudit)");
  });
});
