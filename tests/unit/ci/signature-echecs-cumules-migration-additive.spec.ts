/**
 * La migration du compteur d'échecs cumulé (signature renforcée du devis, audit sécurité) est ADDITIVE :
 * une table neuve et vide, aucune colonne ajoutée ailleurs, aucun DROP/DELETE/UPDATE, horodatage
 * postérieur à la dernière migration de la branche (la signature renforcée, 20261107120000).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "20261107140000_signature_echecs_cumules";
const BRUT = readFileSync(
  join(process.cwd(), "prisma", "migrations", NOM, "migration.sql"),
  "utf8",
);
const sql = BRUT.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration échecs cumulés : additive", () => {
  it("est postérieure à la migration de la signature renforcée", () => {
    expect(Number(NOM.slice(0, 14))).toBeGreaterThan(20261107120000);
  });

  it("ne crée qu'une table neuve et son index unique (pièce, partie)", () => {
    expect(sql).toMatch(/CREATE TABLE\s+"document_signature_echecs"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX[^;]+\("document_genere_id", "partie"\)/);
    expect(sql).not.toMatch(/ALTER TABLE/i);
  });

  it("ne retire, ne renomme et n'écrase rien", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bUPDATE\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/CREATE TYPE|ALTER TYPE/i);
  });

  it("porte le retour arrière en commentaire", () => {
    expect(BRUT).toMatch(/--\s+DROP TABLE IF EXISTS "document_signature_echecs"/);
  });
});
