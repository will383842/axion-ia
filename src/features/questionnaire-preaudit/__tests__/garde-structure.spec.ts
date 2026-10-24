/**
 * Gardes de structure du questionnaire de pré-audit (2026-10-24) :
 *   · la migration est ré-exécutable (aucun `ADD CONSTRAINT` nu) ;
 *   · les en-têtes de `next.config.ts` sont ceux de `entetes.ts` (bac à sable) ;
 *   · `PURGE_PLANIFIEE = true` n'est permis que si une tâche appelle vraiment la purge ;
 *   · le jeton du pré-audit a son propre domaine HMAC ;
 *   · l'export et l'effacement passent par la portée « dirigeant seul ».
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { jetonPreaudit, jetonPreauditValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { jetonQuestionnaire, jetonValide } from "@/server/visio/questionnaire-en-ligne/jeton";
import { PURGE_PLANIFIEE } from "../config";
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
    else if (/\.(ts|tsx)$/.test(nom) && !/\.spec\.tsx?$/.test(nom)) sortie.push(p);
  }
  return sortie;
}

describe("la purge de rétention", () => {
  it("PURGE_PLANIFIEE ne passe à true que si une tâche du worker appelle la purge", () => {
    const appelants = sources(path.join(RACINE, "src/server/queue")).filter((p) =>
      /purgerReponsesAnciennes/.test(readFileSync(p, "utf8")),
    );
    if (PURGE_PLANIFIEE) expect(appelants.length).toBeGreaterThan(0);
    else expect(PURGE_PLANIFIEE).toBe(false);
  });

  it("brouillons : AUCUNE purge appelée tant que PURGE_PLANIFIEE est false, la tâche ensuite", () => {
    const rel = (p: string) => path.relative(RACINE, p).replace(/\\/g, "/");
    const appelants = sources(path.join(RACINE, "src"))
      .filter((p) => /purgerBrouillonsInactifs\(/.test(readFileSync(p, "utf8")))
      .map(rel)
      .filter((p) => p !== "src/features/questionnaire-preaudit/brouillon.ts");
    if (PURGE_PLANIFIEE)
      expect(appelants.some((p) => p.startsWith("src/server/queue/"))).toBe(true);
    else expect(appelants).toEqual([]);
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
