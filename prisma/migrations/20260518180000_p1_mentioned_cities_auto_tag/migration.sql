-- City Domination Sprint S+2 — Phase C strat ville
-- Auto-tagging géographique des articles blog
--
-- Permet au hub ville `/implantations/[region]/[ville]` de filtrer
-- automatiquement les articles blog pertinents (mentions de villes dans
-- le body, scan via helper `extractMentionedCitiesFromText`).
--
-- Doctrine zero-downtime :
--   - ADDITIVE pure (ADD COLUMN avec DEFAULT [])
--   - Aucune contrainte FK
--   - Index GIN pour filter `WHERE 'paris' = ANY(mentioned_cities)` performant
--   - Backfill non requis pour V1 — articles existants conservent [] vide,
--     ils restent indexables mais n'apparaissent dans aucun hub ville tant
--     que le retro-tag worker (Sprint S+3 si besoin) ne tourne pas.
--
-- Migration compatible build externalisé GH Actions + stub.invalid
-- (cf AGENTS.md) — aucune lecture/transformation données existantes.

ALTER TABLE "articles"
  ADD COLUMN "mentioned_cities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Index GIN pour ANY(...) lookup performant (~10K articles cible).
-- Postgres natif pour text[] array containment.
CREATE INDEX "articles_mentioned_cities_idx"
  ON "articles" USING GIN ("mentioned_cities");
