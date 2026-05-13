-- KB V4 (Sprint KB-12.5) — pgvector embeddings pour dedup factory + recherche hybride.
-- Extension `vector` doit être installée (cf. docker/postgres/init.sql + docker-compose
-- image pgvector/pgvector:pg16). En prod Coolify : `CREATE EXTENSION vector` requis.

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable knowledge_embeddings
CREATE TABLE IF NOT EXISTS "knowledge_embeddings" (
    "id" UUID NOT NULL,
    "translation_id" UUID NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "model_version" VARCHAR(40) NOT NULL,
    "dimensionality" INTEGER NOT NULL DEFAULT 1024,
    "embedded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_embeddings_translation_id_key"
  ON "knowledge_embeddings"("translation_id");

CREATE INDEX IF NOT EXISTS "knowledge_embeddings_model_idx"
  ON "knowledge_embeddings"("model");

ALTER TABLE "knowledge_embeddings"
  ADD CONSTRAINT "knowledge_embeddings_translation_id_fkey"
  FOREIGN KEY ("translation_id") REFERENCES "knowledge_translations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Index HNSW cosine_ops (pgvector 0.5+). m=16, ef_construction=64 (defaults V1).
-- À monitorer + tune en KB-22 V4 (RAG production) si nécessaire.
CREATE INDEX IF NOT EXISTS "knowledge_embeddings_hnsw_cosine_idx"
  ON "knowledge_embeddings"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
