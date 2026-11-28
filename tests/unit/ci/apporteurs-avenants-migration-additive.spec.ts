/**
 * La migration `apporteurs_avenants` (#2512, lot S1) est ADDITIVE : une table nouvelle, un index, un index
 * unique partiel, sans clé étrangère, sans énumération Postgres, sans donnée. Le rollback met de côté sans rien supprimer.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "prisma", "migrations", "20261128180000_apporteurs_avenants");
const lire = (f: string) => readFileSync(join(DOSSIER, f), "utf8");
const instructions = (sql: string) =>
  sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migration apporteurs_avenants : additive", () => {
  it("les deux fichiers existent", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
  });
  it("un CREATE TABLE et deux CREATE INDEX, rien d'autre", () => {
    const ins = instructions(lire("migration.sql"));
    expect(ins).toHaveLength(3);
    expect(ins[0]).toMatch(/^CREATE TABLE IF NOT EXISTS "apporteur_avenants" \(/);
    expect(ins[1]).toMatch(
      /^CREATE INDEX IF NOT EXISTS "apporteur_avenants_apporteur_id_idx" ON "apporteur_avenants"\(/,
    );
    expect(ins[2]).toMatch(
      /^CREATE UNIQUE INDEX IF NOT EXISTS "apporteur_avenants_une_active_uniq" ON "apporteur_avenants"\("apporteur_id"\) WHERE "statut" IN \('propose', 'accepte', 'enregistre'\)$/,
    );
  });
  it("aucun DROP, aucune clé étrangère, aucune énumération", () => {
    for (const i of instructions(lire("migration.sql")))
      expect(i).not.toMatch(
        /\b(?:DROP|ALTER|UPDATE|DELETE|TRUNCATE|INSERT|RENAME|GRANT|REVOKE|COPY|REFERENCES|FOREIGN|TYPE|ENUM|DO)\b|\$\w*\$|\/\*/i,
      );
  });
  it("statut en liste fermée", () => {
    expect(lire("migration.sql")).toContain(
      `CHECK ("statut" IN ('propose', 'accepte', 'enregistre', 'decline', 'retire'))`,
    );
  });
  it("le rollback renomme seulement (rien n'est supprimé)", () => {
    expect(instructions(lire("rollback.sql"))).toEqual([
      "BEGIN",
      'ALTER TABLE IF EXISTS "apporteur_avenants" RENAME TO "apporteur_avenants_archive"',
      "COMMIT",
    ]);
  });
});
