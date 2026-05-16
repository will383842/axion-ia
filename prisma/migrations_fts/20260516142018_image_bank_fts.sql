-- Image-bank GIN + FTS raw indexes (Prisma ne supporte pas natif)
-- À lancer APRÈS migration `20260516142017_add_image_bank_tables`.
-- Idempotent (IF NOT EXISTS partout).

-- ============================================================
-- GIN indexes sur jsonb arrays (recherche contains rapide)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_image_assets_target_countries
  ON image_assets USING GIN (target_countries jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_image_assets_target_languages
  ON image_assets USING GIN (target_languages jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_image_assets_keywords_secondary
  ON image_assets USING GIN (keywords_secondary jsonb_path_ops);

-- ============================================================
-- FTS tsvector pour recherche full-text sur translations
-- ============================================================
-- Pondération :
--   A = title, alt        (search:1.0)
--   B = caption           (search:0.4)
--   C = description       (search:0.2)

ALTER TABLE image_asset_translations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(alt, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(caption, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(description, ''))), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_image_asset_translations_search
  ON image_asset_translations USING GIN (search_vector);

-- ============================================================
-- Index composites pour queries publiques fréquentes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_image_asset_translations_pub_recent
  ON image_asset_translations (language_code, is_published, published_at DESC)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_image_assets_active_published
  ON image_assets (is_active, published_at DESC)
  WHERE is_active = true AND deleted_at IS NULL AND published_at IS NOT NULL;

-- ============================================================
-- V1.1 — Indexes taxonomie métier
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_image_assets_module_published
  ON image_assets (module, published_at DESC)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_image_assets_target_city
  ON image_assets (target_city)
  WHERE target_city IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_image_assets_target_region
  ON image_assets (target_region)
  WHERE target_region IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- Vérification (à lancer après migration)
-- ============================================================
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename LIKE 'image_%' ORDER BY tablename, indexname;
-- EXPLAIN ANALYZE SELECT * FROM image_assets WHERE target_countries @> '["FR"]'::jsonb;
--   → doit utiliser idx_image_assets_target_countries (cost < 100, time < 50ms)
