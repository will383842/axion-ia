# Rollback procédure — Migrations Image Bank V1

> **Statut** : Procédure manuelle (Prisma ne génère pas de DOWN SQL).
> **Source** : audit V1 verification 2026-05-16 — P1-9 (cf. `_AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/01-schema-migrations.md`).
> **Dernière mise à jour** : 2026-05-16.

---

## Pourquoi un rollback manuel

Prisma Migrate ne gère que le forward (UP). Pour annuler une migration, il
faut :

1. Soit `prisma migrate resolve --rolled-back <migration_name>` (marque
   comme rollback, ne ré-exécute pas mais ne supprime PAS les tables/colonnes
   créées — il faut le faire à la main).
2. Soit exécuter un script SQL DOWN écrit manuellement.

**Toute opération de rollback en prod doit être précédée d'un snapshot
Postgres Hetzner + cf. `_AUDIT/RESCALE-CPX42-CHECKLIST.md`.**

---

## Migration `20260516142016_create_country_table`

UP : crée la table `countries` (249 rows seed REST Countries API).

DOWN (manuel) :

```sql
-- Vérifier d'abord les FK qui dépendent de `countries` :
--   SELECT conname, conrelid::regclass FROM pg_constraint
--   WHERE confrelid = 'countries'::regclass;
-- Aujourd'hui : 0 FK directe (ImageAsset.target_countries est JSON ISO codes,
-- pas FK Prisma).

DROP TABLE IF EXISTS "countries" CASCADE;
```

---

## Migration `20260516142017_add_image_bank_tables`

UP : crée les 9 tables core image-bank + indexes + FK :
`image_assets`, `image_asset_translations`, `image_categories`,
`image_category_translations`, `image_tags`, `image_tag_translations`,
`image_asset_tags`, `image_usage_logs`, `image_download_logs`,
`image_import_batches`.

DOWN (manuel) — ordre IMPORTANT (FK dépendances) :

```sql
-- Logs append-only (pas de FK out, juste in)
DROP TABLE IF EXISTS "image_download_logs" CASCADE;
DROP TABLE IF EXISTS "image_usage_logs" CASCADE;

-- M:N + translations (cascade depuis Asset/Tag/Category)
DROP TABLE IF EXISTS "image_asset_tags" CASCADE;
DROP TABLE IF EXISTS "image_tag_translations" CASCADE;
DROP TABLE IF EXISTS "image_category_translations" CASCADE;
DROP TABLE IF EXISTS "image_asset_translations" CASCADE;

-- Tables racines
DROP TABLE IF EXISTS "image_import_batches" CASCADE;
DROP TABLE IF EXISTS "image_tags" CASCADE;
DROP TABLE IF EXISTS "image_categories" CASCADE;
DROP TABLE IF EXISTS "image_assets" CASCADE;
```

⚠️ **DESTRUCTIF** : supprime TOUTES les images publiées + variants WebP/AVIF
DB-tracked. Les fichiers physiques storage (`public/image-bank/<uuid>/...`)
restent et doivent être purgés manuellement si besoin.

---

## Migration `20260516142018_image_bank_fts.sql` (raw FTS)

UP : ajoute 3 GIN indexes + tsvector generated column `search_vector` +
indexes composites filtrés.

DOWN (manuel) :

```sql
-- GIN indexes
DROP INDEX IF EXISTS "idx_image_assets_target_countries";
DROP INDEX IF EXISTS "idx_image_assets_target_languages";
DROP INDEX IF EXISTS "idx_image_assets_keywords_secondary";

-- Generated column FTS (PostgreSQL 12+ STORED)
DROP INDEX IF EXISTS "idx_image_asset_translations_search_vector";
ALTER TABLE "image_asset_translations" DROP COLUMN IF EXISTS "search_vector";

-- Indexes composites filtrés
DROP INDEX IF EXISTS "idx_image_assets_pub_recent";
DROP INDEX IF EXISTS "idx_image_assets_active_published";
DROP INDEX IF EXISTS "idx_image_assets_module_published";
DROP INDEX IF EXISTS "idx_image_assets_target_city";
DROP INDEX IF EXISTS "idx_image_assets_target_region";
```

---

## Migration `20260516170000_image_bank_lookup_temporal_fields`

UP : ajoute `created_at` + `updated_at` sur 3 tables lookup
(`image_category_translations`, `image_tags`, `image_tag_translations`).

DOWN (manuel) :

```sql
ALTER TABLE "image_category_translations"
  DROP COLUMN IF EXISTS "created_at",
  DROP COLUMN IF EXISTS "updated_at";

ALTER TABLE "image_tags"
  DROP COLUMN IF EXISTS "created_at",
  DROP COLUMN IF EXISTS "updated_at";

ALTER TABLE "image_tag_translations"
  DROP COLUMN IF EXISTS "created_at",
  DROP COLUMN IF EXISTS "updated_at";
```

---

## Procédure générale de rollback (pas seulement image-bank)

1. **Snapshot Hetzner Postgres** avant toute opération destructive.
2. **Coolify → Stop app** (anti-écriture concurrente).
3. `psql $DATABASE_URL < rollback.sql` (le SQL ci-dessus, dans l'ordre).
4. `psql -c "UPDATE _prisma_migrations SET rolled_back_at = NOW() WHERE migration_name LIKE '%image_bank%' AND finished_at IS NOT NULL;"` (Prisma official rollback tracking).
5. **Tester** que `pnpm prisma migrate status` montre les migrations rollback.
6. **Reverter** le code TypeScript correspondant (`git revert <commit>`).
7. **Coolify → Restart app** + smoke healthcheck.

Pour annuler juste l'ajout d'une colonne sans toucher au schema entier :
préférer `prisma migrate resolve --rolled-back <migration_name>` + suppression
manuelle de la colonne (la migration UP ne sera pas ré-appliquée
automatiquement, donc moins risqué que un drop de table).
