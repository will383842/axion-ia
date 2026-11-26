SET lock_timeout = '5s';

-- PR4 — Embeddings Voyage AI (voyage-3, 1024 dim) pour la détection des doublons
-- et la voix de marque, en parallèle de la colonne OpenAI existante.
--
-- MIGRATION ADDITIVE UNIQUEMENT : une colonne nullable + un index. La colonne
-- `embedding` (vector(1536), OpenAI) et son index HNSW ne sont PAS touchés.
-- Aucun DROP, aucun ALTER de colonne existante, aucun backfill dans la migration
-- (le rattrapage se fait par le worker, par lots, avec plafond).
--
-- Compatibilité « deux conteneurs » (AGENTS.md) : l'ancien worker/app ignore cette
-- colonne (aucun SELECT * sur articles ne la lit : champ `Unsupported`), donc la
-- migration seule est sans danger. En revanche l'ORDRE D'ALLUMAGE est imposé : ne poser
-- `CONTENT_EMBEDDING_PROVIDER=voyage` ni `VOYAGE_ARTICLES_BACKFILL_ENABLED` qu'après
-- l'atterrissage de l'app (en-tête `x-axion-build-sha`) et la présence de la colonne,
-- avec la MÊME valeur sur l'app ET sur le worker (deux conteneurs).
--
-- pgvector déjà actif (cf 20260514020000_kb_v4_pgvector_embeddings).

ALTER TABLE "articles"
    ADD COLUMN IF NOT EXISTS "embedding_voyage" vector(1024);

-- Index HNSW cosine, mêmes paramètres par défaut que articles_embedding_hnsw_idx.
CREATE INDEX IF NOT EXISTS "articles_embedding_voyage_hnsw_idx"
    ON "articles" USING hnsw ("embedding_voyage" vector_cosine_ops);

RESET lock_timeout;

-- Retour arrière (manuel, jamais exécuté par Prisma ; à ne faire qu'après avoir remis
-- CONTENT_EMBEDDING_PROVIDER=openai et redémarré app + worker) :
--   DROP INDEX IF EXISTS "articles_embedding_voyage_hnsw_idx";
--   ALTER TABLE "articles" DROP COLUMN IF EXISTS "embedding_voyage";
