/**
 * La migration `apporteurs_validation_rendez_vous` (réseau d'apporteurs, lot 1) est ADDITIVE.
 * Garde en LISTE EXACTE : lignes de commentaire retirées, texte découpé sur `;`, la liste des
 * instructions de migration.sql et de rollback.sql est figée. Aucun DROP, UPDATE, DELETE ni ALTER
 * sur une table existante ; aucune clé étrangère. Toute instruction de plus doit être ajoutée ici
 * sciemment.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261125090000_apporteurs_validation_rendez_vous";
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

const debut = (i: string, n = 70): string => i.slice(0, n);

describe("migration apporteurs_validation_rendez_vous : additive (liste exacte)", () => {
  it("migration.sql et rollback.sql existent ; le nom est unique", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(
      readdirSync(RACINE).filter((d) => /^\d{14}_apporteurs_validation_rendez_vous$/.test(d)),
    ).toEqual([NOM]);
  });

  it("migration.sql : exactement 2 CREATE TABLE et 4 CREATE INDEX, dans cet ordre", () => {
    const ins = instructions(lireSql("migration.sql"));
    expect(ins.map((i) => debut(i, i.indexOf("(") > 0 ? i.indexOf("(") + 1 : 70))).toEqual([
      'CREATE TABLE IF NOT EXISTS "presentation_reservation" (',
      'CREATE INDEX IF NOT EXISTS "presentation_reservation_reservee_jusqu_at_idx" ON "presentation_reservation"(',
      'CREATE TABLE IF NOT EXISTS "propositions_rendez_vous_presentation" (',
      'CREATE UNIQUE INDEX IF NOT EXISTS "propositions_rendez_vous_presentation_presentation_id_rende_key" ON "propositions_rendez_vous_presentation"(',
      'CREATE UNIQUE INDEX IF NOT EXISTS "presentation_reservation_rendez_vous_valide_key" ON "presentation_reservation"(',
      'CREATE UNIQUE INDEX IF NOT EXISTS "propositions_rendez_vous_presentation_retenue_key" ON "propositions_rendez_vous_presentation"(',
    ]);
  });

  it("les deux index uniques partiels portent leur clause WHERE", () => {
    const ins = instructions(lireSql("migration.sql"));
    expect(ins).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "presentation_reservation_rendez_vous_valide_key" ON "presentation_reservation"("rendez_vous_cle") WHERE "validee_at" IS NOT NULL',
    );
    expect(ins).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS "propositions_rendez_vous_presentation_retenue_key" ON "propositions_rendez_vous_presentation"("rendez_vous_cle") WHERE "retenue_at" IS NOT NULL',
    );
  });

  it("aucun mot interdit ni clé étrangère dans migration.sql", () => {
    for (const i of instructions(lireSql("migration.sql"))) {
      expect(i, debut(i)).not.toMatch(
        /\b(?:DROP|ALTER|UPDATE|DELETE|TRUNCATE|INSERT|RENAME|GRANT|REVOKE|COPY|REFERENCES|FOREIGN|DO)\b|\$\w*\$|--|\/\*/i,
      );
    }
  });

  it("rollback.sql : liste exacte, il met de côté sans rien supprimer", () => {
    expect(instructions(lireSql("rollback.sql"))).toEqual([
      "BEGIN",
      'CREATE SCHEMA IF NOT EXISTS "retrait"',
      'ALTER TABLE "propositions_rendez_vous_presentation" SET SCHEMA "retrait"',
      'ALTER TABLE "presentation_reservation" SET SCHEMA "retrait"',
      "COMMIT",
    ]);
  });

  it("contre-témoin : une instruction ajoutée change la liste", () => {
    const mig = instructions(lireSql("migration.sql"));
    const ajout = instructions(`${lireSql("migration.sql")}\nDROP TABLE "clients";`);
    expect(ajout).not.toEqual(mig);
    expect(ajout).toHaveLength(mig.length + 1);
  });
});
