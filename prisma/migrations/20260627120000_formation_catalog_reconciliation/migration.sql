-- Réconciliation catalogue → DB (WS2, 2026-06-27) — additif uniquement.
-- Ajoute le socle du merge 3-way qui maintient la table `formations` alignée sur
-- le catalogue marketing (catalog-v2.ts, SSOT public) sans jamais écraser une
-- édition admin :
--   - catalog_snapshot   : valeurs catalogue (7 champs) à la dernière synchro =
--                          baseline du merge 3-way (catalogue vs DB vs snapshot).
--   - catalog_synced_at  : horodatage de la dernière synchro réussie.
--   - catalog_drift_at   : horodatage du dernier écart non résolu (édition admin
--                          divergente + catalogue qui a bougé) → revue manuelle.
-- Toutes nullables, aucun backfill : les lignes existantes (créées en mode
-- create-only) ont snapshot NULL et seront adoptées au prochain import.
-- Idempotent.
ALTER TABLE "formations" ADD COLUMN IF NOT EXISTS "catalog_snapshot" JSONB;
ALTER TABLE "formations" ADD COLUMN IF NOT EXISTS "catalog_synced_at" TIMESTAMP(3);
ALTER TABLE "formations" ADD COLUMN IF NOT EXISTS "catalog_drift_at" TIMESTAMP(3);
