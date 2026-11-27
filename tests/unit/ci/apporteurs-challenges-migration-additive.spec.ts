/**
 * La migration `apporteurs_challenges` est ADDITIVE : une seule table nouvelle, sans clé étrangère,
 * sans énumération, sans donnée d'exemple (le brouillon est l'état par défaut : rien n'est visible
 * d'un apporteur). Le rollback met de côté sans rien supprimer.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(process.cwd(), "prisma", "migrations", "20261127120000_apporteurs_challenges");
const lire = (f: string) => readFileSync(join(DOSSIER, f), "utf8");
const instructions = (sql: string) =>
  sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((i) => i.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("migration apporteurs_challenges : additive", () => {
  it("les deux fichiers existent", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
  });
  it("un CREATE TABLE et un CREATE INDEX, rien d'autre", () => {
    const ins = instructions(lire("migration.sql"));
    expect(ins).toHaveLength(2);
    expect(ins[0]).toMatch(/^CREATE TABLE IF NOT EXISTS "challenges_apporteur" \(/);
    expect(ins[1]).toMatch(
      /^CREATE INDEX IF NOT EXISTS "challenges_apporteur_statut_debut_idx" ON "challenges_apporteur"\(/,
    );
  });
  it("aucun mot interdit, aucune clé étrangère, aucune énumération", () => {
    for (const i of instructions(lire("migration.sql")))
      expect(i).not.toMatch(
        /\b(?:DROP|ALTER|UPDATE|DELETE|TRUNCATE|INSERT|RENAME|GRANT|REVOKE|COPY|REFERENCES|FOREIGN|TYPE|ENUM|DO)\b|\$\w*\$|\/\*/i,
      );
  });
  it("brouillon par défaut et contraintes de liste fermée", () => {
    const sql = lire("migration.sql");
    expect(sql).toContain(`"statut" VARCHAR(20) NOT NULL DEFAULT 'brouillon'`);
    expect(sql).toContain(`CHECK ("statut" IN ('brouillon', 'publie', 'archive'))`);
    expect(sql).toContain(`CHECK ("produit" IN ('journee-ia'))`);
    expect(sql).toContain(`CHECK ("seuil" BETWEEN 1 AND 999)`);
  });
  it("le rollback renomme seulement (rien n'est supprimé)", () => {
    const ins = instructions(lire("rollback.sql"));
    expect(ins).toEqual([
      "BEGIN",
      'ALTER TABLE IF EXISTS "challenges_apporteur" RENAME TO "challenges_apporteur_archive"',
      "COMMIT",
    ]);
  });
});
