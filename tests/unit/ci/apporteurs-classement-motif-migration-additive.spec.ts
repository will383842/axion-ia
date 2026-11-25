/**
 * La migration `apporteurs_classement_motif` (lot L2) est ADDITIVE : un seul ADD COLUMN IF NOT EXISTS,
 * nullable, aucun DROP, UPDATE ni DELETE.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261125120000_apporteurs_classement_motif",
);

const instructions = (sql: string): string[] =>
  sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter((i) => i !== "");

describe("migration apporteurs_classement_motif : additive", () => {
  it("migration.sql : un seul ADD COLUMN IF NOT EXISTS, nullable", () => {
    expect(instructions(readFileSync(join(DOSSIER, "migration.sql"), "utf8"))).toEqual([
      'ALTER TABLE "apporteur_reseau_retrait" ADD COLUMN IF NOT EXISTS "motif" TEXT',
    ]);
  });

  it("rollback.sql ne supprime aucune donnée", () => {
    const sql = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  });
});
