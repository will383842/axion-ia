-- Migration: add_calendly_location
-- Sprint Notif Infra 2026-05-26 / fix P1-4 audit 2026-05-27.
--
-- Additif strict (nullable, pas de backfill bloquant).

ALTER TABLE "calendly_events"
    ADD COLUMN IF NOT EXISTS "location" VARCHAR(500);
