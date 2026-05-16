-- Patch post-audit V1 verification 2026-05-16 P1-8.
-- Ajoute created_at + updated_at sur 3 tables lookup image-bank :
--   - image_category_translations
--   - image_tags
--   - image_tag_translations
-- (image_categories les a déjà depuis Sprint 1).
--
-- Motivation : audit trail conformité doctrine "createdAt+updatedAt partout
-- sauf logs append-only". Permet de tracer quand un tag/translation a été
-- modifié (Sprint 2.x admin /image-bank/tags + /categories édition).
--
-- Idempotence : IF NOT EXISTS sur ADD COLUMN (PostgreSQL ≥ 9.6).
-- Default NOW() à l'ajout (les lignes existantes pré-Sprint 1 prennent now()
-- comme valeur historique — acceptable car seeds initial = aujourd'hui).
--
-- Rollback manuel (Prisma n'a pas de DOWN SQL) :
--   ALTER TABLE image_category_translations DROP COLUMN IF EXISTS created_at, DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE image_tags DROP COLUMN IF EXISTS created_at, DROP COLUMN IF EXISTS updated_at;
--   ALTER TABLE image_tag_translations DROP COLUMN IF EXISTS created_at, DROP COLUMN IF EXISTS updated_at;

ALTER TABLE "image_category_translations"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "image_tags"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "image_tag_translations"
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
