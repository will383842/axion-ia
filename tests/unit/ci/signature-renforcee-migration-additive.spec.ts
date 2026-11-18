/**
 * La migration de la signature renforcée du devis (lot 4 bis) est ADDITIVE.
 *
 * L'app joue les migrations au démarrage ; le worker lit le code TS et peut tourner avant ou après
 * (AGENTS.md, « DEUX conteneurs »). La migration ne fait donc qu'AJOUTER : colonnes nullables sans
 * défaut, une table neuve, ses déclencheurs de refus. Jamais de DROP, de DELETE ni d'UPDATE de données.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NOM = "20261107120000_devis_signature_renforcee";
const SQL_BRUT = readFileSync(
  join(process.cwd(), "prisma", "migrations", NOM, "migration.sql"),
  "utf8",
);
/** Le SQL sans ses commentaires `--` (le « retour arrière » y est écrit, jamais exécuté). */
const sql = SQL_BRUT.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration signature renforcée : additive", () => {
  it("est postérieure à l'archive des CGV", () => {
    expect(Number(NOM.slice(0, 14))).toBeGreaterThan(20261104160000);
  });

  it("n'ajoute que des colonnes nullables et une table neuve", () => {
    expect(sql).toMatch(/CREATE TABLE\s+"document_signature_horodatages"/);
    for (const col of [
      "jeton_id",
      "bloque_jusqu_a",
      "declaration_nom",
      "declaration_fonction",
      "pouvoir_declare_at",
      "code_verifie_at",
    ]) {
      expect(sql).toMatch(new RegExp(`ADD COLUMN "${col}" [A-Z0-9()]+(,|;)`));
    }
    expect(sql).not.toMatch(/NOT NULL DEFAULT[^,]*\bADD COLUMN/);
  });

  it("ne retire, ne renomme et n'écrase rien", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+"/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
  });

  it("n'utilise aucune énumération", () => {
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/ALTER TYPE/i);
  });

  it("l'horodatage est en ajout seul (DELETE, TRUNCATE refusés) et un jeton obtenu est définitif", () => {
    expect(sql).toMatch(/BEFORE DELETE ON "document_signature_horodatages"/);
    expect(sql).toMatch(/BEFORE TRUNCATE ON "document_signature_horodatages"/);
    expect(sql).toMatch(/un jeton obtenu est definitif/);
  });

  it("porte le retour arrière en commentaire", () => {
    expect(SQL_BRUT).toMatch(/--\s+DROP TABLE IF EXISTS "document_signature_horodatages"/);
  });
});
