/**
 * La migration `apporteurs_tva_figee` (réseau d'apporteurs, TVA des commissions, lot 3) est ADDITIVE.
 * Garde en LISTE EXACTE : lignes de commentaire retirées, texte découpé sur `;`. Aucun DROP, UPDATE,
 * DELETE, TRUNCATE ni ALTER sur une table existante ; aucune clé étrangère ; aucune valeur
 * d'énumération nouvelle (fenêtre app/worker). Le seul INSERT reprend les pièces déjà émises, vers
 * `pieces_autofacture_apporteur` uniquement, avec `ON CONFLICT ("numero") DO NOTHING`.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261126140000_apporteurs_tva_figee";
const DOSSIER = join(RACINE, NOM);
const lireSql = (f: string): string => readFileSync(join(DOSSIER, f), "utf8");

function instructions(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter((i) => i !== "");
}

const debut = (i: string, n = 80): string => i.slice(0, n);

describe("migration apporteurs_tva_figee : additive (liste exacte)", () => {
  it("migration.sql et rollback.sql existent ; le nom est unique", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(readdirSync(RACINE).filter((d) => /^\d{14}_apporteurs_tva_figee$/.test(d))).toEqual([
      NOM,
    ]);
  });

  it("migration.sql : 2 CREATE TABLE, 2 CREATE INDEX, 2 INSERT de reprise, dans cet ordre", () => {
    const ins = instructions(lireSql("migration.sql"));
    expect(ins.map((i) => debut(i, i.indexOf("(") > 0 ? i.indexOf("(") + 1 : 80))).toEqual([
      'CREATE TABLE IF NOT EXISTS "pieces_autofacture_apporteur" (',
      'CREATE INDEX IF NOT EXISTS "pieces_autofacture_apporteur_apporteur_id_idx" ON "pieces_autofacture_apporteur"(',
      'CREATE TABLE IF NOT EXISTS "apporteur_regime_tva_changements" (',
      'CREATE INDEX IF NOT EXISTS "apporteur_regime_tva_changements_apporteur_id_effet_au_idx" ON "apporteur_regime_tva_changements"(',
      'INSERT INTO "pieces_autofacture_apporteur" (',
      'INSERT INTO "pieces_autofacture_apporteur" (',
    ]);
  });

  it("aucun mot interdit ni clé étrangère ; une seule énumération, déjà existante", () => {
    for (const i of instructions(lireSql("migration.sql"))) {
      // « DO NOTHING » est la clause des INSERT de reprise ; un bloc `DO $$` reste interdit partout.
      const motif = i.startsWith("INSERT")
        ? /\b(?:DROP|ALTER|UPDATE|DELETE|TRUNCATE|RENAME|GRANT|REVOKE|COPY|REFERENCES|FOREIGN|CREATE TYPE)\b|\$\w*\$|\/\*/i
        : /\b(?:DROP|ALTER|UPDATE|DELETE|TRUNCATE|RENAME|GRANT|REVOKE|COPY|REFERENCES|FOREIGN|DO|CREATE TYPE)\b|\$\w*\$|\/\*/i;
      expect(i, debut(i)).not.toMatch(motif);
    }
    expect(lireSql("migration.sql")).not.toMatch(/CREATE TYPE|ADD VALUE/i);
  });

  it("chaque INSERT va vers la seule table des pièces, avec ON CONFLICT DO NOTHING, sans totaux inventés", () => {
    const inserts = instructions(lireSql("migration.sql")).filter((i) => i.startsWith("INSERT"));
    expect(inserts).toHaveLength(2);
    for (const i of inserts) {
      expect(i).toContain('INSERT INTO "pieces_autofacture_apporteur"');
      expect(i).toContain('ON CONFLICT ("numero") DO NOTHING');
      // Les totaux restent NULL : on ne reconstitue pas un TTC à partir de lignes qui ont pu bouger.
      expect(i).not.toMatch(/total_(ht|tva|ttc)_cents/);
      expect(i).toContain("'reprise_migration'");
    }
  });

  it("rollback.sql : met de côté sans rien supprimer", () => {
    expect(instructions(lireSql("rollback.sql"))).toEqual([
      "BEGIN",
      'CREATE SCHEMA IF NOT EXISTS "retrait"',
      'ALTER TABLE "apporteur_regime_tva_changements" SET SCHEMA "retrait"',
      'ALTER TABLE "pieces_autofacture_apporteur" SET SCHEMA "retrait"',
      "COMMIT",
    ]);
  });

  it("contre-témoin : une instruction ajoutée change la liste", () => {
    const mig = instructions(lireSql("migration.sql"));
    const ajout = instructions(`${lireSql("migration.sql")}\nDROP TABLE "clients";`);
    expect(ajout).not.toEqual(mig);
    expect(ajout.at(-1)).toBe('DROP TABLE "clients"');
  });
});
