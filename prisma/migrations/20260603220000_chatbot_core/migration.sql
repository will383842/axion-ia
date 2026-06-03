-- Chatbot core (T-01, ADR-CB-03) — 8 tables chat_* + colonne additive Submission.source.
--
-- Style hand-authored idempotent (IF NOT EXISTS / DO-block) aligné sur
-- 20260514020000_kb_v4_pgvector_embeddings (migration manuelle).
--
-- ⚠️ Cette migration NE crée PAS les colonnes pgvector / tsvector
-- (`embedding`, `tsv`, `question_embedding`) : elles sont ajoutées + indexées
-- (HNSW + GIN) par `prisma/migrations_fts/20260603220500_chatbot_fts.sql` (T-02),
-- appliqué via psql, exactement comme `knowledge_translations.search_vector`.
--
-- Migration ADDITIVE : ne touche aucune donnée existante. `submissions.source`
-- est nullable (défaut NULL) → toutes les Submissions historiques restent valides.

-- ============================================================
-- D-LEAD-SOURCE — enum + colonne additive Submission.source
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubmissionSource') THEN
    CREATE TYPE "SubmissionSource" AS ENUM ('form', 'contact_page', 'api', 'import', 'chatbot');
  END IF;
END
$$;

ALTER TABLE "submissions"
  ADD COLUMN IF NOT EXISTS "source" "SubmissionSource";

-- ============================================================
-- chat_tenants
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_tenants" (
    "id" UUID NOT NULL,
    "cle" VARCHAR(120) NOT NULL,
    "nom" VARCHAR(200) NOT NULL,
    "domaine" VARCHAR(255),
    "reglages" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_tenants_cle_key" ON "chat_tenants"("cle");

-- ============================================================
-- chat_kb_chunks (sans embedding/tsv — ajoutés en T-02 migrations_fts)
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_kb_chunks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_type" VARCHAR(40) NOT NULL,
    "source_ref" VARCHAR(255) NOT NULL,
    "categorie" VARCHAR(60) NOT NULL,
    "priorite" VARCHAR(20) NOT NULL DEFAULT 'moyenne',
    "contenu" TEXT NOT NULL,
    "contexte" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_kb_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_kb_chunks_tenant_id_source_type_source_ref_version_key"
  ON "chat_kb_chunks"("tenant_id", "source_type", "source_ref", "version");
CREATE INDEX IF NOT EXISTS "chat_kb_chunks_tenant_id_categorie_idx"
  ON "chat_kb_chunks"("tenant_id", "categorie");
CREATE INDEX IF NOT EXISTS "chat_kb_chunks_tenant_id_actif_idx"
  ON "chat_kb_chunks"("tenant_id", "actif");

-- ============================================================
-- chat_semantic_cache (sans question_embedding — ajouté en T-02)
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_semantic_cache" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "reponse" TEXT NOT NULL,
    "sources" JSONB,
    "valide_jusqu" TIMESTAMP(3),
    "hits" INTEGER NOT NULL DEFAULT 0,
    "knowledge_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_semantic_cache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_semantic_cache_tenant_id_knowledge_version_idx"
  ON "chat_semantic_cache"("tenant_id", "knowledge_version");

-- ============================================================
-- chat_prompt_versions
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_prompt_versions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "contenu" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_prompt_versions_tenant_id_version_key"
  ON "chat_prompt_versions"("tenant_id", "version");
CREATE INDEX IF NOT EXISTS "chat_prompt_versions_tenant_id_actif_idx"
  ON "chat_prompt_versions"("tenant_id", "actif");

-- ============================================================
-- chat_conversations (inclut champs MVP5 T-38 : search_slots/proposed_offers/link_state)
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_uuid" UUID NOT NULL,
    "persona" VARCHAR(60),
    "statut" VARCHAR(20) NOT NULL DEFAULT 'active',
    "page_context" TEXT,
    "submission_id" UUID,
    "resume" TEXT,
    "ip_hash" VARCHAR(64),
    "search_slots" JSONB,
    "proposed_offers" JSONB,
    "link_state" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_conversations_session_uuid_key"
  ON "chat_conversations"("session_uuid");
CREATE INDEX IF NOT EXISTS "chat_conversations_tenant_id_statut_idx"
  ON "chat_conversations"("tenant_id", "statut");

-- ============================================================
-- chat_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "contenu" TEXT NOT NULL,
    "sources" JSONB,
    "tool_calls" JSONB,
    "feedback" INTEGER,
    "latence_ms" INTEGER,
    "modele" VARCHAR(80),
    "cout_estime" DECIMAL(10,5),
    "served_from_cache" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_created_at_idx"
  ON "chat_messages"("conversation_id", "created_at");

-- ============================================================
-- chat_escalations
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_escalations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "conversation_id" UUID,
    "question" TEXT NOT NULL,
    "contexte" TEXT,
    "contact_email" CITEXT,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'ouverte',
    "email_envoye" BOOLEAN NOT NULL DEFAULT false,
    "submission_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_escalations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_escalations_tenant_id_statut_idx"
  ON "chat_escalations"("tenant_id", "statut");

-- ============================================================
-- chat_action_idempotency
-- ============================================================

CREATE TABLE IF NOT EXISTS "chat_action_idempotency" (
    "cle" VARCHAR(64) NOT NULL,
    "resultat" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_action_idempotency_pkey" PRIMARY KEY ("cle")
);

CREATE INDEX IF NOT EXISTS "chat_action_idempotency_created_at_idx"
  ON "chat_action_idempotency"("created_at");

-- ============================================================
-- Foreign keys
-- ============================================================

ALTER TABLE "chat_kb_chunks"
  ADD CONSTRAINT "chat_kb_chunks_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "chat_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_semantic_cache"
  ADD CONSTRAINT "chat_semantic_cache_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "chat_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_prompt_versions"
  ADD CONSTRAINT "chat_prompt_versions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "chat_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "chat_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_escalations"
  ADD CONSTRAINT "chat_escalations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "chat_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_escalations"
  ADD CONSTRAINT "chat_escalations_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
