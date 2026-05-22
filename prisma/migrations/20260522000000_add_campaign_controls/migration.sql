-- Sprint Campaign Controls (§ 25.2 v1.8 2026-05-22)
-- Additive migration — aucun impact sur les lignes existantes.
-- city_processing_mode DEFAULT 'parallel' garantit la rétro-compatibilité.

-- 1. Nouveau statut CoverageStatus.scheduled
ALTER TYPE "CoverageStatus" ADD VALUE IF NOT EXISTS 'scheduled';

-- 2. Nouveau enum CityProcessingMode
DO $$ BEGIN
  CREATE TYPE "CityProcessingMode" AS ENUM ('parallel', 'sequential');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Champs campaign controls sur coverage_campaigns
ALTER TABLE "coverage_campaigns"
  ADD COLUMN IF NOT EXISTS "city_processing_mode" "CityProcessingMode" NOT NULL DEFAULT 'parallel',
  ADD COLUMN IF NOT EXISTS "current_city_index"   INTEGER,
  ADD COLUMN IF NOT EXISTS "start_date"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "end_date"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "recurring_schedule"    TEXT,
  ADD COLUMN IF NOT EXISTS "completed_reason"      TEXT;
