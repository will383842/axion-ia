# DOWN migration — `20260514120000_add_content_gen_core`

> Prisma ne génère pas de down migrations. Ce fichier documente le SQL inverse
> à exécuter manuellement si rollback nécessaire. Référence runbook : R06
> (`docs/runbooks/R06-migration-sql-failed.md`).
>
> ⚠️ **Rollback massif** (17 DROP TABLE + 15 DROP TYPE + 7 DROP CONSTRAINT FK
>
> - 38 DROP INDEX + 4 ALTER ADD DEFAULT + reverts ALTER COLUMN). En pratique,
>   préférer **restore depuis backup pré-migration** (cf. R06 §3 Option A + R22
>   drill). Ce DOWN.md est documentaire pour cas où le restore n'est pas viable
>   (ex. data post-migration à préserver partiellement).

## Précondition rollback

Ne tenter QUE si :

1. Tous les workers content-gen arrêtés (`content-gen-worker`,
   `content-orchestrator-worker`, `content-publish-worker`,
   `content-qa-extract-worker`, `content-similarity-monitor-worker`,
   `content-rss-fetch-worker`, `content-keyword-sync-worker`,
   `content-news-lifecycle-worker`, `content-tier-lifecycle-worker`,
   `content-quality-improver-worker`, `content-google-indexing-worker`).
   → `PAUSE_WORKERS=1` dans Coolify env + restart, ou stop conteneur worker.
2. Container web Coolify arrêté ou en `SKIP_MIGRATE=1` pour éviter
   re-application immédiate.
3. Backup PG récent disponible (cf. R22).
4. `pg_dump --table=content_gen_jobs --table=coverage_campaigns
--table=review_queue --table=content_gen_config` SI data à préserver.

## SQL inverse

```sql
BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1. DROP FOREIGN KEYS (ordre inverse de création)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "content_citations" DROP CONSTRAINT IF EXISTS "content_citations_externalReferenceId_fkey";
ALTER TABLE "content_citations" DROP CONSTRAINT IF EXISTS "content_citations_jobId_fkey";
ALTER TABLE "review_queue" DROP CONSTRAINT IF EXISTS "review_queue_jobId_fkey";
ALTER TABLE "generation_logs" DROP CONSTRAINT IF EXISTS "generation_logs_jobId_fkey";
ALTER TABLE "content_gen_jobs" DROP CONSTRAINT IF EXISTS "content_gen_jobs_campaignId_fkey";
ALTER TABLE "content_gen_jobs" DROP CONSTRAINT IF EXISTS "content_gen_jobs_templateId_fkey";
ALTER TABLE "faqs" DROP CONSTRAINT IF EXISTS "faqs_parent_article_id_fkey";

-- ────────────────────────────────────────────────────────────────────
-- 2. REVERT RENAME INDEX (seo_cache truncated naming)
-- ────────────────────────────────────────────────────────────────────
ALTER INDEX IF EXISTS "knowledge_seo_cache_translation_id_provider_provider_versio_key"
  RENAME TO "knowledge_seo_cache_translation_id_provider_provider_version_ke";

-- ────────────────────────────────────────────────────────────────────
-- 3. DROP INDEXES sur tables existantes (articles + faqs)
-- ────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "articles_indexation_tier_status_idx";
DROP INDEX IF EXISTS "articles_is_news_published_at_idx";
DROP INDEX IF EXISTS "articles_generated_by_job_id_idx";
DROP INDEX IF EXISTS "faqs_indexation_tier_status_idx";
DROP INDEX IF EXISTS "faqs_parent_article_id_idx";
DROP INDEX IF EXISTS "faqs_is_auto_generated_published_at_idx";

-- ────────────────────────────────────────────────────────────────────
-- 4. DROP COLUMNS ajoutés à articles (19 cols)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "articles"
  DROP COLUMN IF EXISTS "template_variant",
  DROP COLUMN IF EXISTS "seo_score",
  DROP COLUMN IF EXISTS "search_intent",
  DROP COLUMN IF EXISTS "readability_score",
  DROP COLUMN IF EXISTS "quality_score",
  DROP COLUMN IF EXISTS "published_at_dateline",
  DROP COLUMN IF EXISTS "promoted_at",
  DROP COLUMN IF EXISTS "plagiarism_score",
  DROP COLUMN IF EXISTS "news_source_url",
  DROP COLUMN IF EXISTS "news_source_name",
  DROP COLUMN IF EXISTS "news_category",
  DROP COLUMN IF EXISTS "kb_chunk_ids",
  DROP COLUMN IF EXISTS "is_news",
  DROP COLUMN IF EXISTS "indexation_tier",
  DROP COLUMN IF EXISTS "generated_by_job_id",
  DROP COLUMN IF EXISTS "faq_json",
  DROP COLUMN IF EXISTS "fact_check_score",
  DROP COLUMN IF EXISTS "editorial_score",
  DROP COLUMN IF EXISTS "direct_answer";

-- ────────────────────────────────────────────────────────────────────
-- 5. DROP COLUMNS ajoutés à faqs (8 cols)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "faqs"
  DROP COLUMN IF EXISTS "search_console_ctr",
  DROP COLUMN IF EXISTS "quality_score",
  DROP COLUMN IF EXISTS "published_at",
  DROP COLUMN IF EXISTS "parent_article_id",
  DROP COLUMN IF EXISTS "is_auto_generated",
  DROP COLUMN IF EXISTS "indexation_tier",
  DROP COLUMN IF EXISTS "generated_by_job_id",
  DROP COLUMN IF EXISTS "enrichment_context";

-- ────────────────────────────────────────────────────────────────────
-- 6. REVERT ALTER COLUMN id DROP DEFAULT (3 KB tables — restore Postgres default)
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE "knowledge_annotations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "knowledge_collections" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "knowledge_seo_cache" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- ────────────────────────────────────────────────────────────────────
-- 7. DROP TABLES content-gen (16 tables, ordre dépendances)
-- ────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS "content_citations";
DROP TABLE IF EXISTS "external_references";
DROP TABLE IF EXISTS "content_metrics";
DROP TABLE IF EXISTS "cost_ledger";
DROP TABLE IF EXISTS "web_vital_samples";
DROP TABLE IF EXISTS "review_queue";
DROP TABLE IF EXISTS "generation_logs";
DROP TABLE IF EXISTS "content_gen_jobs";
DROP TABLE IF EXISTS "coverage_campaigns";
DROP TABLE IF EXISTS "audience_mix_profiles";
DROP TABLE IF EXISTS "coverage_distribution_profiles";
DROP TABLE IF EXISTS "banned_phrases";
DROP TABLE IF EXISTS "author_profiles";
DROP TABLE IF EXISTS "content_templates";
DROP TABLE IF EXISTS "provider_config";
DROP TABLE IF EXISTS "content_gen_config";

-- ────────────────────────────────────────────────────────────────────
-- 8. DROP TYPES (15 enums content-gen — KeywordTrackingSource appartient
--    à la migration `20260514100000_add_keyword_tracking`, NE PAS DROP ici)
-- ────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS "WebVitalRating";
DROP TYPE IF EXISTS "WebVitalMetric";
DROP TYPE IF EXISTS "TrustTier";
DROP TYPE IF EXISTS "SearchIntent";
DROP TYPE IF EXISTS "OrganisationType";
DROP TYPE IF EXISTS "CoverageScope";
DROP TYPE IF EXISTS "CoverageStatus";
DROP TYPE IF EXISTS "ReviewStatus";
DROP TYPE IF EXISTS "ProviderRole";
DROP TYPE IF EXISTS "ProviderKey";
DROP TYPE IF EXISTS "ExpansionMode";
DROP TYPE IF EXISTS "IndexationTier";
DROP TYPE IF EXISTS "LogLevel";
DROP TYPE IF EXISTS "ContentGenJobStatus";
DROP TYPE IF EXISTS "ContentType";

-- ────────────────────────────────────────────────────────────────────
-- 9. Marquer la migration rolled-back côté _prisma_migrations
-- ────────────────────────────────────────────────────────────────────
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260514120000_add_content_gen_core';

COMMIT;
```

## Post-rollback

- Restart container web Coolify avec image qui retire le code content-gen (ou
  qui supporte `CONTENT_GEN_DISABLED=true` feature flag).
- Vérifier Sentry : pas d'erreur Prisma `relation "X" does not exist` /
  `column "Y" does not exist`.
- Healthcheck `/api/healthz` returns 200.
- Lancer une crawl indexation manuelle pour invalider sitemap content-gen-only.

## Risque

- **Perte définitive** de toutes les data content-gen (jobs, campagnes, review queue,
  providers configs, banned phrases, templates, ledger coûts, citations, refs externes,
  metrics, web vitals samples).
- Articles publiés par content-gen (avec `generated_by_job_id`, `indexation_tier`,
  `quality_score`, etc.) gardent leur ligne dans `articles` MAIS perdent ces champs
  → impact SEO si tier-1 reposait sur ces colonnes.
- FAQs auto-générées (`is_auto_generated=true`) perdent leur lien `parent_article_id`
  → contenu reste mais maillage parent cassé.
- KB cache SEO (`knowledge_seo_cache`) garde son data mais l'index rebascule sur le
  nom truncated 63-char Postgres natif (cosmetic seulement).
