-- P0-5 Sprint correctif 2026-05-21
-- Problème : pas de champ lockedUntil/lockedBy sur la table keywords.
-- Un crash worker brûlait le keyword définitivement (usageCount incrémenté
-- sans que l'article soit jamais généré, et le keyword restait "en cours"
-- sans possibilité de le libérer automatiquement).
-- Fix : ajout de deux champs permettant un verrou optimiste avec expiration.
-- Pattern : worker pose lockedBy=workerId + lockedUntil=now()+5min,
-- libère en fin de job. Cron keyword-lock-cleanup libère si lockedUntil < now().

-- AlterTable: keywords add lock fields
ALTER TABLE "keywords" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ;
ALTER TABLE "keywords" ADD COLUMN IF NOT EXISTS "locked_by" VARCHAR(120);
