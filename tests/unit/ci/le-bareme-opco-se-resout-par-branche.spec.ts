/**
 * Lot A4 — la migration « barème OPCO par branche et par taille » n'ajoute que
 * des colonnes, et le schéma Prisma déclare ce que la base porte.
 *
 * Aucun barème de départ n'est inséré par ce lot : les pages sources n'ont pas
 * pu être relues (cf. RAPPORT). Le test le VERROUILLE — une insertion future
 * doit arriver par sa propre migration, idempotente (`WHERE NOT EXISTS`).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "../../..");
const DOSSIERS = readdirSync(join(RACINE, "prisma/migrations")).filter((d) =>
  d.endsWith("_bareme_opco_branche_tranche"),
);

describe("migration bareme_opco_branche_tranche", () => {
  it("existe une seule fois, horodatée après le 2026-10-03 23:00:00", () => {
    expect(DOSSIERS).toHaveLength(1);
    expect(DOSSIERS[0]!.slice(0, 14) > "20261003230000").toBe(true);
  });

  const sql = DOSSIERS[0]
    ? readFileSync(join(RACINE, "prisma/migrations", DOSSIERS[0], "migration.sql"), "utf8")
    : "";
  const code = sql.replace(/--.*$/gm, "");

  it("ajoute l'enum, les colonnes et l'index, sans rien retirer ni renommer", () => {
    expect(code).toMatch(
      /CREATE TYPE "TrancheEffectifOpco" AS ENUM \('moins_11', 'de_11_a_49', 'tous'\)/,
    );
    expect(code).toMatch(/ADD COLUMN "idcc" CHAR\(4\)/);
    expect(code).toMatch(
      /ADD COLUMN "tranche_effectif" "TrancheEffectifOpco" NOT NULL DEFAULT 'tous'/,
    );
    expect(code).toMatch(/CREATE INDEX "baremes_opco_opco_idcc_tranche_effectif_date_effet_idx"/);
    expect(code).not.toMatch(/\bDROP\b|\bRENAME\b/i);
  });

  it("contraint l'IDCC à 4 chiffres en NOT VALID (table existante)", () => {
    expect(code).toMatch(/CHECK \("idcc" ~ '\^\[0-9\]\{4\}\$'\) NOT VALID/);
  });

  it("toute insertion de barème y est idempotente (WHERE NOT EXISTS)", () => {
    const inserts = code.match(/INSERT INTO "baremes_opco"/g) ?? [];
    const gardes = code.match(/WHERE NOT EXISTS/g) ?? [];
    expect(gardes.length).toBeGreaterThanOrEqual(inserts.length);
  });

  it("le schéma Prisma déclare les mêmes champs", () => {
    const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
    const modele = schema.slice(schema.indexOf("model BaremeOpco {"));
    const corps = modele.slice(0, modele.indexOf("\n}"));
    expect(corps).toMatch(/idcc\s+String\?\s+@db\.Char\(4\)/);
    expect(corps).toMatch(
      /trancheEffectif\s+TrancheEffectifOpco\s+@default\(tous\)\s+@map\("tranche_effectif"\)/,
    );
    expect(corps).toMatch(/@@index\(\[opco, idcc, trancheEffectif, dateEffet\]\)/);
  });
});

describe("migration baremes_opco_releves_2026 (lot A4b, barèmes relus sur les pages officielles)", () => {
  const dossiers = readdirSync(join(RACINE, "prisma/migrations")).filter((d) =>
    d.endsWith("_baremes_opco_releves_2026"),
  );
  const sql = dossiers[0]
    ? readFileSync(join(RACINE, "prisma/migrations", dossiers[0], "migration.sql"), "utf8")
    : "";
  const code = sql.replace(/--.*$/gm, "");

  it("existe une seule fois", () => {
    expect(dossiers).toHaveLength(1);
  });

  it("chaque insertion est gardée par WHERE NOT EXISTS sur son périmètre, sans UPDATE ni DELETE", () => {
    const inserts = code.match(/INSERT INTO "baremes_opco"/g) ?? [];
    const gardes = code.match(/WHERE NOT EXISTS/g) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    expect(gardes.length).toBe(inserts.length);
    expect(code).not.toMatch(/\b(UPDATE|DELETE|DROP|TRUNCATE)\b/i);
  });

  it("chaque barème porte une source https et une date de relevé", () => {
    const blocs = code.split(/INSERT INTO "baremes_opco"/).slice(1);
    for (const b of blocs) {
      expect(b).toMatch(/'https:\/\/[^']+'/);
      expect(b).toMatch(/TIMESTAMP '2026-10-04 00:00:00'/);
    }
  });
});
