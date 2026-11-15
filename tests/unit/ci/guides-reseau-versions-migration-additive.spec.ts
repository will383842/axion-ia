/**
 * La migration `guides_reseau_versions` (G3) est ADDITIVE : une table, aucune colonne existante touchée,
 * aucune ligne écrite ni supprimée, aucune clé étrangère. Retour arrière = DROP TABLE IF EXISTS.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "prisma", "migrations");
const NOM = "20261115153000_guides_reseau_versions";
const DOSSIER = join(RACINE, NOM);
const sansCommentaires = (f: string): string =>
  readFileSync(join(DOSSIER, f), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

describe("migration guides_reseau_versions : additive", () => {
  it("migration.sql et rollback.sql existent ; le nom est unique", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
    expect(readdirSync(RACINE).filter((d) => d.endsWith("_guides_reseau_versions"))).toEqual([NOM]);
  });
  it("ne crée qu'UNE table, sans clé étrangère", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).toMatch(/CREATE TABLE "guides_reseau_versions"/);
    expect(sql).not.toMatch(/FOREIGN KEY|REFERENCES/i);
  });
  it("ne supprime, ne modifie ni n'écrit rien d'existant", () => {
    const sql = sansCommentaires("migration.sql");
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\b/i,
      /\bINSERT\b/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });
  it("code sous la forme gde-…, guide-ia exclu ; unicité (code, version) ; index décroissant", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql).toMatch(/"code" ~ '\^gde-\[a-z0-9-\]\{6,24\}\$'/);
    expect(sql).not.toMatch(/guide-ia/);
    expect(sql).toMatch(
      /UNIQUE INDEX "guides_reseau_versions_code_version_key" ON "guides_reseau_versions"\("code", "version"\)/,
    );
    expect(sql).toMatch(
      /INDEX "guides_reseau_versions_code_version_desc_idx" ON "guides_reseau_versions"\("code", "version" DESC\)/,
    );
    expect(sql).toMatch(/BETWEEN 1 AND 100000/);
    expect(sql).toMatch(/'en_cours', 'pret', 'echec'/);
    expect(sql).toMatch(/'r2', 'volume'/);
  });
  it("le retour arrière ne supprime que cette table", () => {
    expect(sansCommentaires("rollback.sql").trim()).toBe(
      'DROP TABLE IF EXISTS "guides_reseau_versions";',
    );
  });
  it("le modèle Prisma porte les mêmes noms de table et de colonnes", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const bloc = schema.match(/model GuideReseauVersion \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(bloc).toMatch(/@@map\("guides_reseau_versions"\)/);
    for (const c of [
      "sha256_texte",
      "sha256_pdf",
      "taille_octets",
      "cle_objet",
      "cree_le",
      "modifie_le",
    ]) {
      expect(bloc).toContain(`"${c}"`);
    }
  });
});
