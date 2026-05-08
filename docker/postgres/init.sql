-- AxionIA · Postgres dev init (Sprint 15 / M8)
-- Extensions activées au boot du conteneur.
-- citext = email/slugs case-insensitive
-- pg_trgm = recherche fuzzy (admin search)
-- unaccent = recherche FTS sans accents
-- uuid-ossp = uuid_generate_v4() côté SQL si besoin
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- FTS dictionary fr_unaccent (sans accents) pour articles/help/case_studies.
-- Création idempotente — wrap en DO block pour éviter le doublon au restart.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'fr_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION fr_unaccent (COPY = french);
    ALTER TEXT SEARCH CONFIGURATION fr_unaccent
      ALTER MAPPING FOR hword, hword_part, word
      WITH unaccent, french_stem;
  END IF;
END
$$;
