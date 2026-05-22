-- Migration Phase 8 Sprint Keywords Perfection 2026-05-22
-- Extension KeywordTracking : intelligence concurrentielle + tracking avancé

ALTER TABLE "keyword_tracking"
  ADD COLUMN IF NOT EXISTS "competitor_top_url"   VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "competitor_top_name"  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "competitor_weaknesses" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "axion_opportunity"    VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "recommended_action"   TEXT,
  ADD COLUMN IF NOT EXISTS "our_first_rank_at"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "our_best_rank"        INTEGER,
  ADD COLUMN IF NOT EXISTS "our_current_rank"     INTEGER,
  ADD COLUMN IF NOT EXISTS "trend_direction"      VARCHAR(10);

-- Index sur axion_opportunity pour les dashboards
CREATE INDEX IF NOT EXISTS "keyword_tracking_axion_opportunity_idx"
  ON "keyword_tracking" ("axion_opportunity");
