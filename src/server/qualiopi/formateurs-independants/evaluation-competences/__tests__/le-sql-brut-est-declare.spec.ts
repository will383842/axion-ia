// @vitest-environment node

/**
 * Qualiopi ind. 21 — la migration des évaluations est ADDITIVE, et la table est en
 * AJOUT SEUL : ses triggers et son CHECK sont créés, déclarés, et rien d'autre.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  MIGRATION_EVALUATION_COMPETENCES,
  OBJETS_SQL_EVALUATION,
  TABLE_EVALUATIONS,
} from "../objets-sql";

const SQL = readFileSync(
  path.join(process.cwd(), "prisma/migrations", MIGRATION_EVALUATION_COMPETENCES, "migration.sql"),
  "utf8",
);
const code = SQL.split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration des évaluations de compétences", () => {
  it("est additive : aucun DROP, RENAME, ALTER COLUMN, UPDATE ni DELETE", () => {
    expect(code).not.toMatch(/\bDROP\b|\bRENAME\b|ALTER COLUMN|^\s*UPDATE\b|^\s*DELETE\b/im);
    // Aucune table existante n'est modifiée, hors contraintes posées sur la nouvelle.
    for (const m of code.matchAll(/ALTER TABLE "([^"]+)"/g)) expect(m[1]).toBe(TABLE_EVALUATIONS);
  });

  it("crée chaque objet déclaré, sur la table, et rien de non déclaré", () => {
    const crees = [
      ...[...code.matchAll(/ADD CONSTRAINT "([^"]+)" CHECK/g)].map((m) => m[1]),
      ...[...code.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map((m) => m[1]),
    ].sort();
    expect(crees).toEqual(OBJETS_SQL_EVALUATION.map((o) => o.nom).sort());
  });

  it("refuse UPDATE, DELETE et TRUNCATE", () => {
    expect(code).toMatch(
      new RegExp(
        `BEFORE UPDATE OR DELETE ON "${TABLE_EVALUATIONS}"\\s+FOR EACH ROW EXECUTE FUNCTION "formateurs_preuve_ajout_seul"`,
      ),
    );
    expect(code).toMatch(
      new RegExp(
        `BEFORE TRUNCATE ON "${TABLE_EVALUATIONS}"\\s+FOR EACH STATEMENT EXECUTE FUNCTION "formateurs_preuve_ajout_seul"`,
      ),
    );
  });

  it("le CHECK exige un motif non vide pour toute décision", () => {
    expect(code).toMatch(/"nature" = 'decision_habilitation'[\s\S]*length\(btrim\("motif"\)\) > 0/);
  });
});
