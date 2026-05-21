-- Migration P4 Sprint P0-6+P0-7 — 2026-05-21
-- Ajout de 2 statuts quarantaine dans ContentGenJobStatus
-- + modèle FactCheckClaim pour persistance individuelle des claims factuels

-- P0-7 : statut quarantaine violation P0 critique (AI Act, SIREN hardcodé, etc.)
ALTER TYPE "ContentGenJobStatus" ADD VALUE IF NOT EXISTS 'quarantined_critical';

-- P0-6 : statut quarantaine fact-check score < 50
ALTER TYPE "ContentGenJobStatus" ADD VALUE IF NOT EXISTS 'quarantined_factcheck';

-- P0-6 : table claims factuels (persistance audit trail)
CREATE TABLE IF NOT EXISTS "factcheck_claims" (
    "id" TEXT NOT NULL,
    "article_id" UUID NOT NULL,
    "claim" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'unverified',
    "source_url" VARCHAR(512),
    "source_title" VARCHAR(255),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factcheck_claims_pkey" PRIMARY KEY ("id")
);

-- Index pour lookup par article et par statut
CREATE INDEX IF NOT EXISTS "factcheck_claims_article_id_idx" ON "factcheck_claims"("article_id");
CREATE INDEX IF NOT EXISTS "factcheck_claims_status_idx" ON "factcheck_claims"("status");

-- FK vers articles
ALTER TABLE "factcheck_claims" ADD CONSTRAINT "factcheck_claims_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
