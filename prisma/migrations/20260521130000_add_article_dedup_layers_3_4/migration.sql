-- B.7 P1.5 P0-6 — Article dedup layers 3 (outline SimHash) + 4 (OpenAI embeddings)
--
-- Couche 3 : SimHash 64-bit hex sur sequence h2/h3 (template editorial dedup).
-- Couche 4 : OpenAI text-embedding-3-large vector(1536) + HNSW cosine index.
-- Note dims : text-embedding-3-large supporte dimensions=1536 via API (meilleur que
-- ada-002 a meme dims). pgvector limite HNSW + IVFFlat a 2000 dims max ; 1536 < 2000. OK.
--
-- pgvector extension deja active (cf 20260514020000_kb_v4_pgvector_embeddings).

ALTER TABLE "articles"
    ADD COLUMN IF NOT EXISTS "outline_simhash" VARCHAR(16),
    ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "articles_outline_simhash_idx"
    ON "articles"("outline_simhash");

-- HNSW index pour recherche cosine top-K rapide.
-- m=16 ef_construction=64 = config par defaut pgvector pour 10k+ rows.
CREATE INDEX IF NOT EXISTS "articles_embedding_hnsw_idx"
    ON "articles" USING hnsw ("embedding" vector_cosine_ops);
