/**
 * La migration `oppositions_marques_crm` est ADDITIVE : deux colonnes nullables sur `email_oppositions`,
 * rien d'autre (app et worker peuvent tourner l'un avant l'autre, AGENTS.md « DEUX conteneurs »).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261106100000_oppositions_marques_crm",
);
const sansCommentaires = (t: string): string =>
  t
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const sql = sansCommentaires(readFileSync(join(DOSSIER, "migration.sql"), "utf8"));

describe("migration oppositions_marques_crm : additive", () => {
  it("n'ajoute que deux colonnes TIMESTAMPTZ NULL", () => {
    const instructions = sql
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    expect(instructions).toHaveLength(2);
    expect(instructions[0]).toBe(
      'ALTER TABLE "email_oppositions" ADD COLUMN "crm_en_attente_depuis" TIMESTAMPTZ NULL',
    );
    expect(instructions[1]).toBe(
      'ALTER TABLE "email_oppositions" ADD COLUMN "crm_interdit_le" TIMESTAMPTZ NULL',
    );
  });

  it("ne supprime, ne renomme et n'écrit rien", () => {
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /\bINSERT\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bDEFAULT\b/i,
      /\bNOT NULL\b/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });

  it("rollback.sql présent : deux DROP COLUMN IF EXISTS", () => {
    const f = join(DOSSIER, "rollback.sql");
    expect(existsSync(f)).toBe(true);
    const r = readFileSync(f, "utf8");
    expect(r.match(/DROP COLUMN IF EXISTS/g)).toHaveLength(2);
    expect(r).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE)\b/i);
  });
});
