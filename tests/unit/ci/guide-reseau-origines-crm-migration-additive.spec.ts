/**
 * La migration `guide_reseau_origines_crm` (lot guide réseau 4, O1) est ADDITIVE : deux colonnes
 * nullables et un index partiel sur une table existante. Aucune reprise de données, aucun DROP
 * (AGENTS.md « DEUX conteneurs » : l'ancien conteneur ignore les colonnes et continue de tourner).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261112100000_guide_reseau_origines_crm",
);
const lire = (): string =>
  readFileSync(join(DOSSIER, "migration.sql"), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

describe("migration guide_reseau_origines_crm : additive", () => {
  it("existe", () => {
    expect(existsSync(join(DOSSIER, "migration.sql"))).toBe(true);
  });

  it("n'ajoute que deux colonnes nullables et un index partiel", () => {
    const sql = lire();
    expect(sql).toMatch(/ADD COLUMN "crm_statut"\s+VARCHAR\(16\)(?!\s+NOT NULL)/);
    expect(sql).toMatch(/ADD COLUMN "crm_traitee_le"\s+TIMESTAMPTZ\(3\)(?!\s+NOT NULL)/);
    expect(sql).toMatch(/CREATE INDEX "guide_reseau_origines_crm_a_faire_idx"/);
    expect(sql).toMatch(/WHERE "crm_statut" IS NULL/);
  });

  it("ne supprime, ne renomme, n'écrit rien", () => {
    const sql = lire();
    for (const re of [
      /\bDROP\b/i,
      /\bDELETE\b/i,
      /\bUPDATE\b/i,
      /\bINSERT\b/i,
      /\bRENAME\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER COLUMN\b/i,
      /\bCREATE TYPE\b/i,
      /\bALTER TABLE "(?!guide_reseau_origines")/i,
    ]) {
      expect(sql).not.toMatch(re);
    }
  });

  it("le schéma Prisma porte les deux colonnes, nullables", () => {
    const m = /model GuideReseauOrigine \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
    expect(m).toMatch(/crmStatut\s+String\?\s+@map\("crm_statut"\)/);
    expect(m).toMatch(/crmTraiteeLe\s+DateTime\?\s+@map\("crm_traitee_le"\)/);
  });

  it("le commentaire de la clé de dédoublonnage ne parle plus de date", () => {
    expect(schema).not.toMatch(
      /SHA-256 de \(mot, reseau, guide, post_ref, canal, date à la seconde\)/,
    );
  });
});
