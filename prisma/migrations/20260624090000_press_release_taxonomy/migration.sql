-- Taxonomie « ciblage média » des communiqués (2026-06-24) — permet aux
-- journalistes de filtrer /presse par région, département, secteur et audience.
-- 100 % additif : colonnes nullables (region/departement/sector) + colonne avec
-- valeur par défaut (audience). Aucun drop, aucune colonne requise sans défaut.

-- CreateEnum
CREATE TYPE "PressReleaseAudience" AS ENUM ('GENERAL', 'FOUNDER');

-- AlterTable
ALTER TABLE "press_releases"
    ADD COLUMN "region" VARCHAR(64),
    ADD COLUMN "departement" VARCHAR(8),
    ADD COLUMN "sector" VARCHAR(64),
    ADD COLUMN "audience" "PressReleaseAudience" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "press_releases_region_idx" ON "press_releases"("region");

-- CreateIndex
CREATE INDEX "press_releases_sector_idx" ON "press_releases"("sector");

-- CreateIndex
CREATE INDEX "press_releases_audience_idx" ON "press_releases"("audience");
