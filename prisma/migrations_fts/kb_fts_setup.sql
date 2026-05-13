-- KB-7 — FTS Postgres FR + EN sur knowledge_translations
-- Pattern aligné sur prisma/migrations_fts/0002_fts_setup.sql (Article/CaseStudy/HelpArticle existant).
-- Config fr_unaccent (custom) + english.
-- À appliquer après migrations Prisma :
--   psql $DATABASE_URL -f prisma/migrations_fts/kb_fts_setup.sql

ALTER TABLE knowledge_translations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    CASE locale
      WHEN 'fr'::"Locale" THEN
        setweight(to_tsvector('fr_unaccent', coalesce(title, '')),       'A') ||
        setweight(to_tsvector('fr_unaccent', coalesce(excerpt, '')),     'B') ||
        setweight(to_tsvector('fr_unaccent', coalesce(body_text, '')),   'C')
      WHEN 'en'::"Locale" THEN
        setweight(to_tsvector('english',     coalesce(title, '')),       'A') ||
        setweight(to_tsvector('english',     coalesce(excerpt, '')),     'B') ||
        setweight(to_tsvector('english',     coalesce(body_text, '')),   'C')
      ELSE to_tsvector('simple', coalesce(title, ''))
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS knowledge_translations_search_idx
  ON knowledge_translations USING GIN (search_vector);

-- Trigram fuzzy sur title pour autocomplete admin (KB-3 list filter)
CREATE INDEX IF NOT EXISTS knowledge_translations_title_trgm_idx
  ON knowledge_translations USING GIN (title gin_trgm_ops);
