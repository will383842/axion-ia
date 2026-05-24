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

-- Index for campaign filtering.
-- Sprint Final 2026-05-22 (audit-final ci gate d fix) : CONCURRENTLY retiré
-- car Prisma 5.22 wrappe les migrations dans une transaction et postgres
-- interdit CREATE INDEX CONCURRENTLY in transaction (P3018 / E25001).
-- L'index a été créé en prod via admin-emergency-migrate 2026-05-22 (CI Gate D
-- fresh DB est la seule cible non-impactée par cette modif).
CREATE INDEX IF NOT EXISTS "articles_campaign_id_idx" ON "articles"("campaign_id");
