// Test de CONTRAT de schéma (T2) — prouve, au build (sans DB), que la migration
// additive `prospection_init` crée bien toutes les tables + les contraintes
// UNIQUE d'anti-doublon (01-DATA-MODEL, 06-MATRICE T2), et n'exécute AUCUN `DROP`.
// L'enforcement runtime des contraintes (insert doublon rejeté) est exercé en
// CI/prod sur une vraie base Postgres (`prisma migrate deploy`).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const MIGRATION_SQL = readFileSync(
  path.resolve(
    __dirname,
    "../../../prisma/migrations/20260704000000_prospection_init/migration.sql",
  ),
  "utf8",
);

const EXPECTED_TABLES = [
  "prospection_company",
  "prospection_establishment",
  "prospection_person",
  "prospection_person_role",
  "prospection_contact",
  "prospection_campaign",
  "prospection_coverage_cell",
  "prospection_collect_run",
  "prospection_event",
  "prospection_access_log",
  "prospection_tag",
  "prospection_company_tag",
  "prospection_suppression_entry",
  "prospection_stock_reference",
  "prospection_geo_coverage_stat",
  "prospection_stats_snapshot",
];

describe("migration prospection_init — additive", () => {
  it("crée les 16 tables du module", () => {
    for (const table of EXPECTED_TABLES) {
      expect(MIGRATION_SQL, table).toContain(`CREATE TABLE "${table}"`);
    }
    expect((MIGRATION_SQL.match(/CREATE TABLE /g) ?? []).length).toBe(16);
  });

  it("n'exécute AUCUNE opération destructive (additif strict)", () => {
    expect(MIGRATION_SQL).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE|CONSTRAINT|INDEX|SCHEMA|VIEW)/i);
    expect(MIGRATION_SQL).not.toMatch(/\bTRUNCATE\b/i);
    expect(MIGRATION_SQL).not.toMatch(/\bRENAME\b/i);
    expect(MIGRATION_SQL).not.toMatch(/ALTER\s+COLUMN[\s\S]*?\bTYPE\b/i);
    // Aucun DELETE sur une table existante (les seules écritures sont des CREATE).
    expect(MIGRATION_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it("étend l'enum SiteSettingCategory avec 'prospection' (ADD VALUE IF NOT EXISTS — idempotent)", () => {
    expect(MIGRATION_SQL).toMatch(
      /ALTER TYPE "SiteSettingCategory" ADD VALUE IF NOT EXISTS 'prospection'/,
    );
  });
});

describe("contraintes UNIQUE d'anti-doublon (06-MATRICE T2)", () => {
  // Prisma nomme les uniques `<table>_<cols>_key`. On vérifie la présence des
  // index/contraintes uniques structurants de la dédup.
  const REQUIRED_UNIQUE = [
    // 1 SIREN = 1 Company
    /CREATE UNIQUE INDEX "prospection_company_siren_key" ON "prospection_company"\("siren"\)/,
    // 1 SIRET = 1 Establishment (succursales ≠ doublons)
    /CREATE UNIQUE INDEX "prospection_establishment_siret_key" ON "prospection_establishment"\("siret"\)/,
    // dédup personne (companyId, personKey) — fonction hors clé
    /CREATE UNIQUE INDEX "prospection_person_company_id_person_key_key" ON "prospection_person"\("company_id", "person_key"\)/,
    // dédup contact (companyId, type, valueNormalized)
    /CREATE UNIQUE INDEX "prospection_contact_company_id_type_value_normalized_key" ON "prospection_contact"\("company_id", "type", "value_normalized"\)/,
    // cellule unique (campaignId, departement, naf, taille) — nom tronqué à 63 car. par Postgres
    /CREATE UNIQUE INDEX "prospection_coverage_cell_campaign_id_departement_naf_taill\w*" ON "prospection_coverage_cell"\("campaign_id", "departement", "naf", "taille"\)/,
    // suppression (type, valueNormalized)
    /CREATE UNIQUE INDEX "prospection_suppression_entry_type_value_normalized_key" ON "prospection_suppression_entry"/,
    // dénominateur (departement, naf, taille)
    /CREATE UNIQUE INDEX "prospection_stock_reference_departement_naf_taille_key" ON "prospection_stock_reference"/,
    // rollup (scope, scopeId, dimKey)
    /CREATE UNIQUE INDEX "prospection_geo_coverage_stat_scope_scope_id_dim_key_key" ON "prospection_geo_coverage_stat"/,
  ];

  it("toutes les contraintes UNIQUE de dédup sont présentes", () => {
    for (const re of REQUIRED_UNIQUE) {
      expect(MIGRATION_SQL, re.source).toMatch(re);
    }
  });

  it("les FK entreprise sont en cascade (purge RGPD propage)", () => {
    expect(MIGRATION_SQL).toMatch(
      /prospection_establishment_company_id_fkey".*REFERENCES "prospection_company".*ON DELETE CASCADE/s,
    );
  });
});
