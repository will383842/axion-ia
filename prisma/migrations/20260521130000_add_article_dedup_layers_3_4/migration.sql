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

-- IVFFlat index pour recherche cosine top-K rapide.
-- HNSW pgvector limite a 2000 dims max ; text-embedding-3-large = 3072 → IVFFlat obligatoire.
-- lists=1 : valeur minimale valide sur table vide (CI fresh DB) ; en prod avec >10k rows,
-- creer un index concurrent avec lists=100 via migration dedie apres backfill.
CREATE INDEX IF NOT EXISTS "articles_embedding_ivfflat_idx"
    ON "articles" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 1);
