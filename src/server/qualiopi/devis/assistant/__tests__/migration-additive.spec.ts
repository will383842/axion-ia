/**
 * S01 — la migration des brouillons de l'assistant de devis est PUREMENT ADDITIVE.
 *
 * Pourquoi ce test : la mise en ligne se fait en deux temps (l'ancien conteneur
 * tourne encore pendant ~1 h sur le nouveau schéma). Toute instruction qui
 * modifie ou retire quelque chose d'existant casserait l'ancien code.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const DOSSIER = "20261108120000_devis_assistant_brouillons";
const CHEMIN_SQL = join(RACINE, "prisma", "migrations", DOSSIER, "migration.sql");
const CHEMIN_SCHEMA = join(RACINE, "prisma", "schema.prisma");

function lireSql(): string {
  expect(existsSync(CHEMIN_SQL), `migration absente : ${CHEMIN_SQL}`).toBe(true);
  return readFileSync(CHEMIN_SQL, "utf8");
}

/** Instructions exécutables : commentaires `--` retirés, découpe sur `;`. */
function instructions(sql: string): string[] {
  return sql
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("S01 — migration additive des brouillons d'assistant de devis", () => {
  it("ne contient que CREATE TABLE, CREATE (UNIQUE) INDEX et ADD CONSTRAINT … FOREIGN KEY", () => {
    const liste = instructions(lireSql());
    expect(liste.length).toBeGreaterThan(0);
    for (const instr of liste) {
      const ok =
        /^CREATE TABLE "devis_assistant_brouillons"/.test(instr) ||
        /^CREATE (UNIQUE )?INDEX /.test(instr) ||
        /^ALTER TABLE "devis_assistant_brouillons" ADD CONSTRAINT .+ FOREIGN KEY /s.test(instr);
      expect(ok, `instruction non additive : ${instr.slice(0, 80)}`).toBe(true);
    }
  });

  it("n'emploie aucun DROP, ALTER COLUMN, CREATE TYPE, RENAME, DELETE, TRUNCATE ni DELETE FROM / UPDATE", () => {
    const sansCommentaires = instructions(lireSql()).join(";\n");
    for (const interdit of [
      /\bDROP\b/i,
      /\bALTER\s+COLUMN\b/i,
      /\bCREATE\s+TYPE\b/i,
      /\bRENAME\b/i,
      /\bDELETE\s+FROM\b/i, // « ON DELETE SET NULL » d'une clé étrangère reste permis
      /\bTRUNCATE\b/i,
      /\bUPDATE\s+"/i, // « ON UPDATE CASCADE » reste permis
      /\bADD\s+COLUMN\b/i,
    ]) {
      expect(sansCommentaires).not.toMatch(interdit);
    }
  });

  it("ne touche que la table neuve (aucune autre table modifiée)", () => {
    for (const instr of instructions(lireSql())) {
      if (/^ALTER TABLE/i.test(instr)) {
        expect(instr).toMatch(/^ALTER TABLE "devis_assistant_brouillons"/);
      }
      if (/^CREATE (UNIQUE )?INDEX/i.test(instr)) {
        expect(instr).toMatch(/ON "devis_assistant_brouillons"/);
      }
    }
  });

  it("porte toutes les colonnes de la section 3 du plan", () => {
    const sql = lireSql();
    const colonnes = [
      "id",
      "created_by_admin_id",
      "client_id",
      "devis_id",
      "vente_brouillon_id",
      "etape",
      "statut",
      "payload",
      "payload_version",
      "revision",
      "derniere_sauvegarde_id",
      "verrou_depuis",
      "created_at",
      "updated_at",
    ];
    for (const c of colonnes) expect(sql, `colonne ${c}`).toMatch(new RegExp(`"${c}" `));
    expect(sql).toMatch(/"created_by_admin_id" UUID NOT NULL/);
    expect(sql).toMatch(/"statut" VARCHAR\(16\) NOT NULL DEFAULT 'en_cours'/);
    expect(sql).toMatch(/"payload" JSONB NOT NULL DEFAULT '\{\}'/);
    expect(sql).toMatch(/"etape" SMALLINT NOT NULL DEFAULT 1/);
    expect(sql).toMatch(/"revision" INTEGER NOT NULL DEFAULT 0/);
    expect(sql).not.toMatch(/retention_until/);
  });

  it("pose les index (admin+updated_at, client) et l'unicité de devis_id, et deux FK en SET NULL", () => {
    const sql = lireSql();
    expect(sql).toMatch(/CREATE UNIQUE INDEX [^\n]*ON "devis_assistant_brouillons"\("devis_id"\)/);
    expect(sql).toMatch(
      /CREATE INDEX [^\n]*ON "devis_assistant_brouillons"\("created_by_admin_id", "updated_at"\)/,
    );
    expect(sql).toMatch(/CREATE INDEX [^\n]*ON "devis_assistant_brouillons"\("client_id"\)/);
    expect(sql).toMatch(
      /FOREIGN KEY \("client_id"\) REFERENCES "clients"\("id"\) ON DELETE SET NULL/,
    );
    expect(sql).toMatch(/FOREIGN KEY \("devis_id"\) REFERENCES "devis"\("id"\) ON DELETE SET NULL/);
    // admin et brouillon de vente : liens logiques, sans clé étrangère.
    expect(sql).not.toMatch(/FOREIGN KEY \("created_by_admin_id"\)/);
    expect(sql).not.toMatch(/FOREIGN KEY \("vente_brouillon_id"\)/);
  });

  it("le modèle Prisma DevisAssistantBrouillon existe, avec relations inverses sur Client et Devis", () => {
    const schema = readFileSync(CHEMIN_SCHEMA, "utf8");
    const modele = schema.match(/model DevisAssistantBrouillon \{[\s\S]*?\n\}/);
    expect(modele, "modèle DevisAssistantBrouillon").not.toBeNull();
    expect(modele![0]).toMatch(/@@map\("devis_assistant_brouillons"\)/);
    expect(modele![0]).toMatch(/devisId\s+String\?\s+@unique/);
    const client = schema.match(/model Client \{[\s\S]*?\n\}/)![0];
    const devis = schema.match(/model Devis \{[\s\S]*?\n\}/)![0];
    expect(client).toMatch(/DevisAssistantBrouillon\[\]/);
    expect(devis).toMatch(/DevisAssistantBrouillon\??\s/);
  });
});
