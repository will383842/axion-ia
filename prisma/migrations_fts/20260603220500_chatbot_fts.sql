-- Chatbot FTS + pgvector (T-02, ADR-CB-03/CB-04/CB-05).
--
-- À appliquer APRÈS la migration Prisma `20260603220000_chatbot_core` :
--   psql $DATABASE_URL -f prisma/migrations_fts/20260603220500_chatbot_fts.sql
--
-- Pourquoi hors Prisma migrate : Prisma 5.22 ne gère ni vector(1024) ni tsvector
-- généré ni index HNSW/GIN. Doctrine alignée sur 0002_fts_setup.sql (Article/…)
-- + 20260514020000_kb_v4_pgvector_embeddings (knowledge_embeddings).
--
-- Colonnes ajoutées ici (déclarées Unsupported dans schema.prisma, lues via
-- $queryRaw par le retrieval hybride T-06) :
--   chat_kb_chunks.embedding        vector(1024)  (écrite par l'ingestion Voyage T-05)
--   chat_kb_chunks.tsv              tsvector      (GÉNÉRÉE depuis contenu+contexte)
--   chat_semantic_cache.question_embedding vector(1024) (écrite par le cache T-26)
--
-- Config FTS française : `fr_unaccent` (créée par docker/postgres/init.sql),
-- IDENTIQUE à kb_fts_setup.sql / 0002_fts_setup.sql. Chatbot FR-only.

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- chat_kb_chunks — embedding (HNSW cosine) + tsv (GIN, fr_unaccent)
-- ============================================================

ALTER TABLE "chat_kb_chunks"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

-- tsv GÉNÉRÉE : contenu (poids A) + phrase de contextualisation (poids B).
ALTER TABLE "chat_kb_chunks"
  ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('fr_unaccent', coalesce("contenu", '')),  'A') ||
    setweight(to_tsvector('fr_unaccent', coalesce("contexte", '')), 'B')
  ) STORED;

-- HNSW cosine (pgvector 0.5+). m=16, ef_construction=64 (defaults V1, aligné kb).
CREATE INDEX IF NOT EXISTS "chat_kb_chunks_embedding_hnsw_idx"
  ON "chat_kb_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "chat_kb_chunks_tsv_gin_idx"
  ON "chat_kb_chunks" USING GIN ("tsv");

-- ============================================================
-- chat_semantic_cache — question_embedding (HNSW cosine)
-- ============================================================

ALTER TABLE "chat_semantic_cache"
  ADD COLUMN IF NOT EXISTS "question_embedding" vector(1024);

CREATE INDEX IF NOT EXISTS "chat_semantic_cache_question_embedding_hnsw_idx"
  ON "chat_semantic_cache"
  USING hnsw ("question_embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
