/**
 * La migration `garanties_journee_ia` est ADDITIVE (AGENTS.md « DEUX conteneurs ») : une table neuve,
 * ses index, les clés étrangères de CETTE table. Rien d'existant n'est altéré ; aucune énumération.
 * Aucun code de worker ni de cron ne la lit dans cette PR.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const sql = readFileSync(
  join(RACINE, "prisma", "migrations", "20261125150000_garanties_journee_ia", "migration.sql"),
  "utf8",
)
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf8");

describe("migration garanties_journee_ia : additive", () => {
  it("ne contient que CREATE TABLE, CREATE INDEX et les clés étrangères de la table neuve", () => {
    const instr = sql
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    for (const i of instr) {
      expect(i).toMatch(
        /^(CREATE TABLE "garanties_journee_ia"|CREATE (UNIQUE )?INDEX "garanties_journee_ia_|ALTER TABLE "garanties_journee_ia" ADD CONSTRAINT)/,
      );
    }
    expect(instr.filter((i) => i.startsWith("CREATE TABLE"))).toHaveLength(1);
  });
  it("ne supprime, ne renomme, n'écrit et ne crée aucune énumération", () => {
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bUPDATE\s+"/i,
      /\bINSERT\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bCREATE TYPE\b/i,
      /\bALTER TYPE\b/i,
      /\bALTER COLUMN\b/i,
      /\bALTER TABLE "(?!garanties_journee_ia")/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });
  it("le modèle est annoté RGPD, sans énumération, avec la décision en texte", () => {
    const m = /\/\/\/ rgpd: technique[^\n]*\nmodel GarantieJourneeIa \{[\s\S]*?\n\}/.exec(schema);
    expect(m).not.toBeNull();
    expect(m?.[0]).toMatch(/decision\s+String\?\s+@db\.VarChar\(20\)/);
    expect(m?.[0]).not.toMatch(/\bdecision\s+Decision/);
  });
  it("aucun code de worker ni de cron ne lit la table (cron en PR 3)", () => {
    const fautifs: string[] = [];
    const pile = [join(RACINE, "src", "server", "queue")];
    while (pile.length) {
      const dossier = pile.pop() as string;
      for (const n of readdirSync(dossier)) {
        const p = join(dossier, n);
        if (statSync(p).isDirectory()) pile.push(p);
        else if (
          /\.tsx?$/.test(n) &&
          /garantieJourneeIa|garanties_journee_ia/.test(readFileSync(p, "utf8"))
        )
          fautifs.push(p);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
