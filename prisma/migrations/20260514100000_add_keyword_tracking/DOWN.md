# DOWN migration — `20260514100000_add_keyword_tracking`

> Prisma ne génère pas de down migrations. Ce fichier documente le SQL inverse
> à exécuter manuellement si rollback nécessaire. Référence runbook : R06
> (`docs/runbooks/R06-migration-sql-failed.md`).
>
> ⚠️ Toute donnée présente dans la table `keyword_tracking` sera perdue.
> Faire `pg_dump --table=keyword_tracking` avant si data à préserver.

## Précondition rollback

Ne tenter QUE si :

1. La migration `20260514120000_add_content_gen_core` (qui suit) n'a pas encore
   référencé la table → sinon rollback en cascade requis (cf. cette migration
   ne contient PAS de FK vers `keyword_tracking` côté code actuel, mais le
   code TypeScript `src/server/queue/workers/content-keyword-sync-worker.ts`
   et la page admin `keyword-tracking/page.tsx` doivent être désactivés au
   préalable, sinon crash Prisma `relation "keyword_tracking" does not exist`).
2. Le worker `content-keyword-sync-worker` est arrêté (`PAUSE_WORKERS=1` dans
   Coolify env ou `pnpm run worker:stop`).
3. Backup PG récent disponible (cf. R22).

## SQL inverse

```sql
BEGIN;

-- 1. Drop indexes (auto-dropped avec table mais explicite pour clarté)
DROP INDEX IF EXISTS "keyword_tracking_position_idx";
DROP INDEX IF EXISTS "keyword_tracking_syncedAt_idx";
DROP INDEX IF EXISTS "keyword_tracking_articleId_idx";
DROP INDEX IF EXISTS "keyword_tracking_keyword_targetUrl_key";

-- 2. Drop table
DROP TABLE IF EXISTS "keyword_tracking";

-- 3. Drop enum (uniquement si aucune autre table ne l'utilise — vérifier d'abord)
DROP TYPE IF EXISTS "KeywordTrackingSource";

-- 4. Marquer la migration rolled-back côté _prisma_migrations
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260514100000_add_keyword_tracking';

COMMIT;
```

## Post-rollback

- Redémarrer container Coolify avec image qui retire le code `KeywordTracking`
  ou définir feature flag pour skip le worker keyword-sync.
- Vérifier Sentry : pas d'erreur Prisma `relation "keyword_tracking" does not exist`.
- Healthcheck `/api/healthz` returns 200.

## Risque

Perte définitive de toutes les rows `keyword_tracking` insérées. Tier-1 candidates
auto-detection, cannibalization detection, gaps detection ne fonctionneront plus.
À reconstruire au prochain sync cron GSC/SerpAPI après re-apply migration.
