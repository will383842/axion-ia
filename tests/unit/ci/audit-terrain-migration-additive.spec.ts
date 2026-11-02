/**
 * AUDIT PRÉSENTIEL, PR1 — la migration des tables `audit_terrain_*` est ADDITIVE.
 * Compatible avec les DEUX conteneurs (app et worker) : trois tables neuves,
 * aucune énumération Postgres, aucune colonne sur une table existante, aucun
 * DROP/DELETE/UPDATE. Le retour arrière est un fichier à part, jamais joué
 * par `prisma migrate deploy`.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RACINE } from "./sources-du-circuit-visio";

const NOM = "20261102210000_audit_terrain_tables";
const DOSSIER = path.join(RACINE, "prisma", "migrations", NOM);
const TABLES = ["audit_terrain_sessions", "audit_terrain_evenements", "audit_terrain_rapports"];

function sqlSansCommentaires(): string {
  return readFileSync(path.join(DOSSIER, "migration.sql"), "utf8").replace(/--.*$/gm, "");
}

describe("migration audit_terrain_* : additive seulement", () => {
  it("la migration existe et crée exactement les trois tables", () => {
    expect(existsSync(path.join(DOSSIER, "migration.sql"))).toBe(true);
    const creees = [...sqlSansCommentaires().matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]);
    expect(creees.sort()).toEqual([...TABLES].sort());
  });

  it("aucune instruction destructrice ou touchant l'existant", () => {
    // Les actions référentielles (ON DELETE RESTRICT…) ne sont pas des suppressions.
    const sql = sqlSansCommentaires().replace(/ON (DELETE|UPDATE) (RESTRICT|CASCADE)/g, "");
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|TRUNCATE|CREATE TYPE|ALTER TYPE)\b/i);
    // Seuls ALTER TABLE autorisés : ajout de clés étrangères sur les tables NEUVES.
    for (const m of sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)) {
      expect(TABLES).toContain(m[1]);
    }
  });

  it("aucune clé étrangère en cascade : on ne supprime pas par ricochet", () => {
    expect(sqlSansCommentaires()).not.toMatch(/ON DELETE CASCADE/i);
  });

  it("le retour arrière existe, hors de migration.sql, et ne vise que les trois tables", () => {
    const f = path.join(DOSSIER, "rollback.sql");
    expect(existsSync(f)).toBe(true);
    const sql = readFileSync(f, "utf8").replace(/--.*$/gm, "");
    const drops = [...sql.matchAll(/DROP TABLE (?:IF EXISTS )?"([a-z_]+)"/g)].map((m) => m[1]);
    expect(drops.sort()).toEqual([...TABLES].sort());
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/i);
  });

  it("le schéma Prisma déclare les trois modèles, annotés RGPD, contenu en colonnes chiffrées", () => {
    const schema = readFileSync(path.join(RACINE, "prisma", "schema.prisma"), "utf8");
    for (const [modele, table] of [
      ["AuditTerrainSession", TABLES[0]],
      ["AuditTerrainEvenement", TABLES[1]],
      ["AuditTerrainRapport", TABLES[2]],
    ] as const) {
      const re = new RegExp(String.raw`(///[^\n]*\n)+model ${modele} \{[\s\S]*?@@map\("${table}"\)`);
      const bloc = re.exec(schema)?.[0] ?? "";
      expect(bloc, modele).toContain("rgpd: dossier-client");
    }
    expect(schema).toMatch(/donneesChiffrees\s+String/);
    expect(schema).toMatch(/contenuChiffre\s+String/);
  });
});
