/**
 * La migration Q1 de la porte qualité est ADDITIVE (AGENTS.md « DEUX conteneurs ») : deux tables neuves,
 * leurs index et une ligne de réglages `porte_qualite` posée sans écraser une valeur existante. Aucune
 * table existante n'est altérée, aucune énumération, aucune clé étrangère. Colonnes nullables ou avec défaut.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIER = join(RACINE, "prisma", "migrations", "20261127210000_porte_qualite_tables");
const sql = readFileSync(join(DOSSIER, "migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const down = readFileSync(join(DOSSIER, "down.sql"), "utf8");
const TABLES = ["content_quality_verdicts", "porte_cohortes"];

describe("migration porte qualité Q1 : additive", () => {
  it("ne contient que CREATE TABLE, CREATE INDEX et l'insertion des réglages", () => {
    const instr = sql
      .split(/;\s*(?:\n|$)/)
      .map((i) => i.trim())
      .filter(Boolean);
    const t = TABLES.join("|");
    for (const i of instr) {
      expect(i).toMatch(
        new RegExp(
          `^(CREATE TABLE "(${t})"|CREATE (UNIQUE )?INDEX "(${t})_[a-z0-9_]+" ON "(${t})"|INSERT INTO "content_gen_config")`,
        ),
      );
    }
    expect(instr.filter((i) => i.startsWith("CREATE TABLE"))).toHaveLength(2);
  });
  it("ne supprime, ne renomme, n'altère rien et ne crée ni énumération ni clé étrangère", () => {
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
  it("les réglages ne sont posés qu'une fois : une valeur existante n'est jamais écrasée", () => {
    expect(sql).toMatch(/ON CONFLICT \("key"\) DO NOTHING/);
    expect(sql).toContain("'porte_qualite'");
    expect(sql).toContain('"phase":"observation"');
    expect(sql).toContain('"mode":"ombre"');
  });
  it("down.sql s'arrête si une table n'est pas vide, avant toute suppression", () => {
    expect(down.indexOf("RAISE EXCEPTION")).toBeGreaterThan(-1);
    expect(down.indexOf("RAISE EXCEPTION")).toBeLessThan(down.indexOf("DROP TABLE"));
    for (const t of TABLES) expect(down).toContain(`"${t}"`);
  });
});
