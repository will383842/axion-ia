/**
 * La migration `cgv_archives` est ADDITIVE et la table est immuable (preuve d'acceptation des CGV, P1).
 *
 * Le site (APP) joue les migrations au démarrage ; le worker lit le code TS et peut tourner avant ou
 * après (AGENTS.md, « DEUX conteneurs »). La migration ne fait donc que créer une table neuve et
 * ses déclencheurs : UPDATE, DELETE et TRUNCATE y sont refusés.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SQL_BRUT = readFileSync(
  join(process.cwd(), "prisma", "migrations", "20261104160000_cgv_archives", "migration.sql"),
  "utf8",
);

/** Le SQL sans ses commentaires `--` (le « retour arrière » y est écrit, jamais exécuté). */
const sql = SQL_BRUT.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration cgv_archives : additive", () => {
  it("crée la table neuve", () => {
    expect(sql).toMatch(/CREATE TABLE\s+"cgv_archives"/i);
  });

  it("ne retire, ne renomme et n'écrase rien (hors la fonction/les déclencheurs de refus)", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/\bINSERT\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).not.toMatch(/\bUPDATE\s+"/i);
  });

  it("n'utilise aucune énumération", () => {
    expect(sql).not.toMatch(/CREATE TYPE/i);
    expect(sql).not.toMatch(/ALTER TYPE/i);
  });

  it("refuse UPDATE, DELETE et TRUNCATE par déclencheur", () => {
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON "cgv_archives"/i);
    expect(sql).toMatch(/BEFORE TRUNCATE ON "cgv_archives"/i);
  });

  it("borne les empreintes (64 hexadécimaux minuscules) par CHECK", () => {
    expect(sql).toMatch(/"texte_sha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(sql).toMatch(/"pdf_sha256" ~ '\^\[0-9a-f\]\{64\}\$'/);
  });

  it("porte le retour arrière en commentaire", () => {
    expect(SQL_BRUT).toMatch(/--\s+DROP TABLE IF EXISTS "cgv_archives"/);
  });
});
