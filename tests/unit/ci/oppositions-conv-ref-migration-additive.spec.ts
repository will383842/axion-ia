/**
 * La migration `oppositions_conv_ref` (MG-STOP01) est ADDITIVE : une nouvelle table, aucune colonne existante
 * touchée, aucune reprise de données (AGENTS.md « DEUX conteneurs » : l'ancien conteneur l'ignore).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "prisma", "migrations", "20261112120000_oppositions_conv_ref");
const sansCommentaires = (f: string): string =>
  readFileSync(join(DOSSIER, f), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

describe("migration oppositions_conv_ref : additive", () => {
  it("migration.sql et rollback.sql existent", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
  });
  it("ne crée que la table et son unicité", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql).toMatch(/CREATE TABLE "oppositions_conv_ref"/);
    expect(sql).toMatch(/"conv_ref" VARCHAR\(64\) NOT NULL/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "oppositions_conv_ref_conv_ref_key"/);
  });
  it("ne supprime, ne modifie ni n'écrit rien d'existant", () => {
    const sql = sansCommentaires("migration.sql");
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /\bINSERT\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\b/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });
  it("le retour arrière ne supprime que la nouvelle table", () => {
    expect(sansCommentaires("rollback.sql").trim()).toBe(
      'DROP TABLE IF EXISTS "oppositions_conv_ref";',
    );
  });
  it("le schéma Prisma porte le modèle, conv_ref unique", () => {
    const m = /model OppositionConvRef \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
    expect(m).toMatch(/convRef\s+String\s+@unique @map\("conv_ref"\) @db\.VarChar\(64\)/);
    expect(m).toMatch(/@@map\("oppositions_conv_ref"\)/);
  });
});
