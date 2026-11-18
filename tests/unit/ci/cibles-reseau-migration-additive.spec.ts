/**
 * La migration `cibles_reseau` (F1a-bis) est ADDITIVE : deux nouvelles tables, aucune colonne existante touchée,
 * aucune suppression ni modification de ligne. Seule écriture : la fiche de départ `guide-ia` (idempotente).
 * Rien n'est supprimé par le code : on désactive (`actif`).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOTS_INTERDITS } from "@/server/guides-reseau/cibles-reseau";

const DOSSIER = join(process.cwd(), "prisma", "migrations", "20261112140000_cibles_reseau");
const sansCommentaires = (f: string): string =>
  readFileSync(join(DOSSIER, f), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

describe("migration cibles_reseau : additive", () => {
  it("migration.sql et rollback.sql existent", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
    expect(existsSync(join(DOSSIER, "rollback.sql"))).toBe(true);
  });
  it("ne crée que deux tables", () => {
    const sql = sansCommentaires("migration.sql");
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(2);
    expect(sql).toMatch(/CREATE TABLE "cibles_reseau"/);
    expect(sql).toMatch(/CREATE TABLE "mots_cibles"/);
  });
  it("ne supprime ni ne modifie rien d'existant", () => {
    // « ON DELETE RESTRICT / ON UPDATE CASCADE » de la clé étrangère ne sont pas des instructions.
    const sql = sansCommentaires("migration.sql").replace(/ON (?:DELETE |UPDATE )\w+/g, "");
    for (const re of [/\bDROP\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /\bRENAME\b/i, /\bTRUNCATE\b/i]) {
      expect(sql).not.toMatch(re);
    }
    expect(sql).not.toMatch(/ALTER TABLE "(?!mots_cibles")/);
    // Le motif ci-dessus efface aussi `ON DELETE CASCADE` : on le vérifie sur le texte d'origine.
    const brut = sansCommentaires("migration.sql");
    expect(brut).not.toMatch(/ON DELETE (CASCADE|SET NULL)/i);
    expect(brut).toMatch(/ON DELETE RESTRICT/);
    expect(sql.match(/INSERT INTO/g)).toHaveLength(1);
    expect(sql).toMatch(/ON CONFLICT \("code"\) DO NOTHING/);
  });
  it("la règle du mot en base est celle du Studio : 2 à 20", () => {
    expect(sansCommentaires("migration.sql")).toMatch(/\^\[a-z0-9\]\{2,20\}\$/);
  });
  it("la contrainte du mot refuse aussi les chiffres seuls et chaque mot d'opposition du Studio", () => {
    const sql = sansCommentaires("migration.sql");
    const contrainte =
      sql.match(/CONSTRAINT "mots_cibles_mot_forme" CHECK \(([^;]*?)\),\n/s)?.[1] ?? "";
    expect(contrainte).toMatch(/"mot" !~ '\^\[0-9\]\+\$'/);
    const liste = contrainte.match(/"mot" NOT IN \(([^)]*)\)/)?.[1] ?? "";
    const dansSql = [...liste.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(dansSql).toEqual(MOTS_INTERDITS.map((m) => m.toLowerCase()).sort());
  });
  it("le retour arrière dit qu'il efface le catalogue, à n'utiliser qu'avant toute saisie", () => {
    const brut = readFileSync(join(DOSSIER, "rollback.sql"), "utf8");
    expect(brut.split("\n")[0]).toMatch(
      /^--.*uniquement avant toute saisie.*effacerait le catalogue/i,
    );
  });
  it("le retour arrière ne supprime que les deux nouvelles tables, liaisons d'abord", () => {
    expect(sansCommentaires("rollback.sql").trim()).toBe(
      'DROP TABLE IF EXISTS "mots_cibles";\nDROP TABLE IF EXISTS "cibles_reseau";',
    );
  });
});
