-- Axion-IA · FTS tsvector setup (Sprint 15 / M8 — migration 0002)
--
-- À appliquer manuellement APRÈS la migration init Prisma :
--   psql $DATABASE_URL -f prisma/migrations_fts/0002_fts_setup.sql
--
-- Pourquoi pas dans schema.prisma : Prisma 5.22 ne génère pas tsvector +
-- triggers nativement. La doctrine FTS est gérée hors Prisma migrate, mais
-- tracée ici pour reproducibilité (Coolify/Hetzner appliquera ce fichier).
--
-- Configuration TS française sans accents : `fr_unaccent` (créée par
-- docker/postgres/init.sql à l'init du conteneur).

-- ============================================================
-- ARTICLES (article_translations.search_vector)
-- ============================================================

ALTER TABLE article_translations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(title, '')),    'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(excerpt, '')),  'B') ||
    setweight(to_tsvector('fr_unaccent', coalesce(body, '')),     'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS article_translations_search_idx
  ON article_translations USING GIN (search_vector);

-- ============================================================
-- HELP_ARTICLES (help_article_translations.search_vector)
-- ============================================================

ALTER TABLE help_article_translations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(title, '')),    'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(excerpt, '')),  'B') ||
    setweight(to_tsvector('fr_unaccent', coalesce(body, '')),     'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS help_article_translations_search_idx
  ON help_article_translations USING GIN (search_vector);

-- ============================================================
-- CASE_STUDIES (case_study_translations.search_vector)
-- ============================================================

ALTER TABLE case_study_translations
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce(title, '')),    'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce(problem, '')),  'B') ||
    setweight(to_tsvector('fr_unaccent', coalesce(solution, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS case_study_translations_search_idx
  ON case_study_translations USING GIN (search_vector);

-- ============================================================
-- pg_trgm GIN indexes pour recherche fuzzy admin (slugs, emails)
-- ============================================================

CREATE INDEX IF NOT EXISTS submissions_email_trgm_idx
  ON submissions USING GIN (contact_email gin_trgm_ops);

-- NOTE (2026-07-20) : l'index trgm sur `testimonials` a été RETIRÉ d'ici.
-- La table a été supprimée par la migration `20260706160000_drop_testimonials`
-- (le modèle a été remplacé par `customer_reviews`). Le `CREATE INDEX` résiduel
-- faisait échouer ce fichier à CHAQUE boot depuis le 2026-07-06 :
--   Error: P1014 — The underlying table for model `testimonials` does not exist.
-- L'échec était non-fatal (l'entrypoint logge un WARNING et continue), mais il
-- interrompait le fichier : tout statement placé APRÈS ne s'appliquait plus.
-- Ne pas réintroduire sans recréer la table.

CREATE INDEX IF NOT EXISTS bookings_options_email_trgm_idx
  ON bookings_options USING GIN (contact_email gin_trgm_ops);
