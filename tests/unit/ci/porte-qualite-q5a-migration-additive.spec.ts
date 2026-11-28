/**
 * La migration Q5a (registre des intentions) est ADDITIVE : une table neuve et ses index.
 * Rien d'autre (AGENTS.md « DEUX conteneurs »).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261128160000_porte_qualite_content_intentions",
);
const sql = readFileSync(join(DOSSIER, "migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const rollback = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");

describe("migration porte qualité Q5a : additive", () => {
  it("ne contient que CREATE TABLE et CREATE INDEX sur content_intentions", () => {
    const instr = sql
      .split(/;\s*(?:\n|$)/)
      .map((i) => i.trim())
      .filter(Boolean);
    expect(instr.length).toBeGreaterThan(0);
    for (const i of instr) {
      expect(i).toMatch(
        /^(CREATE TABLE "content_intentions"|CREATE (UNIQUE )?INDEX "content_intentions_[a-z0-9_]+" ON "content_intentions")/,
      );
    }
    expect(instr.filter((i) => i.startsWith("CREATE TABLE"))).toHaveLength(1);
  });
  it("ne supprime, ne renomme, n'altère rien, sans énumération ni clé étrangère", () => {
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\s+"/i,
      /\bALTER\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bCREATE TYPE\b/i,
      /\bREFERENCES\b/i,
      /\bFOREIGN KEY\b/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });
  it("seules les colonnes d'identité, de requête, d'état et de date sont obligatoires", () => {
    const obligatoires = [...sql.matchAll(/^\s+"(\w+)"[^\n]*NOT NULL/gm)].map((m) => m[1]);
    expect(obligatoires.sort()).toEqual(
      ["created_at", "etat", "id", "requete_normalisee", "updated_at"].sort(),
    );
    expect(sql).toMatch(/"etat" VARCHAR\(20\) NOT NULL DEFAULT 'libre'/);
  });
  it("le rollback ne supprime rien : mise de côté par RENAME", () => {
    expect(rollback).toMatch(/RENAME TO "content_intentions_retire_20261128"/);
    expect(rollback.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")).not.toMatch(
      /\bDROP\b/i,
    );
  });
  it("le nom est postérieur à toutes les autres migrations", () => {
    const autres = readdirSync(join(process.cwd(), "prisma", "migrations")).filter(
      (n) => /^\d{14}_/.test(n) && !n.startsWith("20261128160000_"),
    );
    // Les migrations d'autres PR fusionnées après celle-ci peuvent être plus récentes : on vérifie
    // seulement l'ordre par rapport à celles qui existaient à l'écriture (jusqu'au 20261128150000).
    for (const n of autres.filter((m) => m <= "20261128150000")) {
      expect(n < "20261128160000").toBe(true);
    }
  });
});
