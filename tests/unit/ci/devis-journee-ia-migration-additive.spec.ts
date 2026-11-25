/**
 * La migration `devis_journee_ia` (C4-a) est ADDITIVE : un seul ADD COLUMN IF NOT EXISTS,
 * valeur par défaut false, aucun DROP, UPDATE ni DELETE.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "prisma", "migrations", "20261126090000_devis_journee_ia");

const instructions = (sql: string): string[] =>
  sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter((i) => i !== "");

describe("migration devis_journee_ia : additive", () => {
  it("migration.sql : un seul ADD COLUMN IF NOT EXISTS, NOT NULL DEFAULT false", () => {
    expect(instructions(readFileSync(join(DOSSIER, "migration.sql"), "utf8"))).toEqual([
      'ALTER TABLE "devis" ADD COLUMN IF NOT EXISTS "journee_ia" BOOLEAN NOT NULL DEFAULT false',
    ]);
  });

  it("rollback.sql ne supprime aucune donnée", () => {
    const sql = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  });
});
