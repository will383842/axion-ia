-- Snapshot légal session→formation (WS5, 2026-06-27) — additif uniquement.
-- Copie figée des champs Formation engageants (titre, durée, objectifs,
-- programme…) au moment de la création de la session, lue en priorité par les
-- documents légaux (convention, attestation, facture) pour ne jamais diverger
-- si la formation évolue après la session. Nullable, aucun backfill : les
-- sessions existantes restent en lecture LIVE de la Formation (fallback).
-- Idempotent.
ALTER TABLE "training_sessions" ADD COLUMN IF NOT EXISTS "formation_snapshot" JSONB;
