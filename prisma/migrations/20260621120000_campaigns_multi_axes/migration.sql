-- Campagnes content-gen multi-axes (2026-06-21) — Phase 1.
-- Migration STRICTEMENT ADDITIVE. Ne touche à aucun objet existant.
-- (Le `prisma migrate diff` global propose des DROP INDEX/COLUMN liés à la
--  dérive schéma↔DB connue — FTS/vector/trgm — qui NE doivent PAS être
--  appliqués ici. Cf. mémoire prod-schema-drift-content-engine-v2.)
--
-- Tous les ajouts sont nullable ou ont un DEFAULT → rétro-compat totale des
-- campagnes existantes (NULL/default = comportement historique).

-- CreateEnum
CREATE TYPE "VilleSurroundingMode" AS ENUM ('none', 'radius', 'same_departement');

-- CreateEnum
CREATE TYPE "DurationMode" AS ENUM ('fixed', 'unlimited');

-- AlterTable
ALTER TABLE "coverage_campaigns"
  ADD COLUMN "service_sector_weights" JSONB,
  ADD COLUMN "target_secteur_weights" JSONB,
  ADD COLUMN "ville_surrounding_mode" "VilleSurroundingMode" NOT NULL DEFAULT 'none',
  ADD COLUMN "ville_surrounding_radius_km" INTEGER,
  ADD COLUMN "duration_mode" "DurationMode" NOT NULL DEFAULT 'fixed';
