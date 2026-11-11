/**
 * La migration des colonnes « informations d'Axion-IA » (case facultative de la page « Recevoir le
 * guide », 2026-11-11) est ADDITIVE : quatre colonnes neuves sur une table existante, rien
 * supprimé, renommé ni écrit (le worker et l'ancien conteneur continuent de tourner).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(
  process.cwd(),
  "prisma",
  "migrations",
  "20261111210000_contacts_guide_reseau_infos_facultatives",
);
const sql = readFileSync(join(DOSSIER, "migration.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration contacts_guide_reseau : colonnes des informations facultatives", () => {
  it("ne fait que quatre ADD COLUMN sur contacts_guide_reseau", () => {
    const instructions = sql
      .split(";")
      .map((i) => i.trim())
      .filter(Boolean);
    expect(instructions).toHaveLength(4);
    for (const i of instructions) {
      expect(i).toMatch(/^ALTER TABLE "contacts_guide_reseau" ADD COLUMN "infos_/);
    }
    for (const re of [/\bDROP\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /\bINSERT\b/i, /\bRENAME\b/i]) {
      expect(sql).not.toMatch(re);
    }
  });

  it("la seule colonne NOT NULL porte un défaut ('aucune' : non cochée)", () => {
    expect(sql).toContain("\"infos_statut\" VARCHAR(20) NOT NULL DEFAULT 'aucune'");
    expect(sql.match(/NOT NULL/g)).toHaveLength(1);
  });
});
