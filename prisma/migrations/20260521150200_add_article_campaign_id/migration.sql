-- P0-6 Sprint correctif 2026-05-21
-- Problème : Article n'a pas de champ campaignId direct. La traçabilité
-- campagne → article passait uniquement par Article.generatedByJobId →
-- ContentGenJob.campaignId (deux niveaux de JOIN, les deux nullable).
-- Cela rendait impossible un filtrage direct des articles par campagne
-- pour les rapports et dashboards.
-- Fix : ajout campaign_id nullable (rétro-compat articles existants) +
-- index pour les requêtes de filtrage par campagne.
-- Note : cuid() de ContentGenJob fait ~25 chars, VARCHAR(25) suffisant.

-- AlterTable: articles add campaign_id (nullable for backward compat)
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "campaign_id" VARCHAR(25);

-- Index for campaign filtering (CONCURRENTLY pour éviter lock table en prod)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "articles_campaign_id_idx" ON "articles"("campaign_id");
