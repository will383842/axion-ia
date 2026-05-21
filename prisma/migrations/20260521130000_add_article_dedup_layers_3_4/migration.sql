-- B.7 P1.5 P0-6 — Article dedup layers 3 (outline SimHash) + 4 (OpenAI embeddings)
--
-- Couche 3 : SimHash 64-bit hex sur sequence h2/h3 (template editorial dedup).
-- Couche 4 : OpenAI text-embedding-3-large vector(3072) + HNSW cosine index.
--
-- pgvector extension deja active (cf 20260514020000_kb_v4_pgvector_embeddings).

ALTER TABLE "articles"
    ADD COLUMN IF NOT EXISTS "outline_simhash" VARCHAR(16),
    ADD COLUMN IF NOT EXISTS "embedding" vector(3072);

CREATE INDEX IF NOT EXISTS "articles_outline_simhash_idx"
    ON "articles"("outline_simhash");

-- HNSW index pour recherche cosine top-K rapide.
-- m=16 ef_construction=64 = config par defaut pgvector pour 10k+ rows.
-- Note : si pgvector < 0.7.0, fallback IVFFlat (cosine_ops aussi disponible).
CREATE INDEX IF NOT EXISTS "articles_embedding_hnsw_idx"
    ON "articles" USING hnsw ("embedding" vector_cosine_ops);
