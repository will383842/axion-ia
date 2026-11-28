/** La migration C12 est ADDITIVE : une table neuve, sans énumération ni clé étrangère, avec retour arrière. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261128180000_contenu_rendez_vous_origines",
);
const sql = readFileSync(join(DOSSIER, "migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration contenu_rendez_vous_origines : additive", () => {
  it("crée une seule table neuve", () => {
    expect(sql.match(/CREATE TABLE/g)?.length).toBe(1);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "contenu_rendez_vous_origines"/);
  });
  it("ne retire, ne renomme, n'écrit aucune donnée, ne touche aucune table existante", () => {
    for (const interdit of [
      /\bDROP\b/i,
      /\bRENAME\b/i,
      /\bINSERT\b/i,
      /\bUPDATE\b/i,
      /\bDELETE\b/i,
    ]) {
      expect(sql).not.toMatch(interdit);
    }
    expect(sql).not.toMatch(/ALTER TABLE/i);
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/REFERENCES|FOREIGN KEY/i);
  });
  it("porte un rollback.sql", () => {
    const r = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");
    expect(r).toMatch(/DROP TABLE IF EXISTS "contenu_rendez_vous_origines"/);
  });
});
