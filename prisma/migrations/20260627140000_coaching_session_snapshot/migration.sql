-- Snapshot légal anti-stale 1-to-1 / AFEST (WS9, 2026-06-27) — additif uniquement.
-- Copie figée du contenu pédagogique engageant d'un parcours de coaching
-- (intitulé résolu, objectifs, heures prévues, modalité, mention certifiante) au
-- moment de la PREMIÈRE émission d'un document légal. Garantit la cohérence des
-- documents successifs d'un même parcours (protocole/attestation/certificat/kits)
-- même si le contenu — ou le libellé catalogue résolu via interventionSlug —
-- change ensuite. Nullable, aucun backfill : les parcours sans document émis
-- restent en lecture LIVE (fallback). Idempotent.
ALTER TABLE "coaching_sessions" ADD COLUMN IF NOT EXISTS "coaching_snapshot" JSONB;
