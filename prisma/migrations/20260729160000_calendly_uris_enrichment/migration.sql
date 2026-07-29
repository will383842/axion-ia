-- Calendly — stockage des URI API + champs d'enrichissement (ADR 0036).
--
-- Contexte : le postMessage `calendly.event_scheduled` de l'Embed JS ne
-- transmet QUE `payload.event.uri` et `payload.invitee.uri` — jamais le nom,
-- l'email ni l'horaire. Le code d'origine lisait `payload.invitee.name/email`,
-- champs qui n'existent pas dans ce payload : toutes les colonnes PII sont
-- donc restées nulles depuis la mise en service. On persiste désormais les
-- deux URI, seules données réelles disponibles, ce qui rend possible :
--   1. la déduplication fiable (invitee_uri unique) ;
--   2. l'enrichissement via l'API Calendly v2 quand CALENDLY_API_TOKEN est posé,
--      y compris rétroactivement sur les lignes déjà captées.
--
-- Toutes les colonnes sont nullable → migration non bloquante, aucune donnée
-- existante n'est touchée.

ALTER TABLE "calendly_events" ADD COLUMN "event_uri" VARCHAR(255);
ALTER TABLE "calendly_events" ADD COLUMN "invitee_uri" VARCHAR(255);
ALTER TABLE "calendly_events" ADD COLUMN "cancel_url" VARCHAR(500);
ALTER TABLE "calendly_events" ADD COLUMN "reschedule_url" VARCHAR(500);
ALTER TABLE "calendly_events" ADD COLUMN "enriched_at" TIMESTAMP(3);

-- Backfill des lignes déjà captées : les URI sont présentes dans raw_payload
-- (le payload brut a toujours été stocké intégralement), simplement jamais
-- extraites en colonnes. Les lignes créées manuellement (raw_payload
-- `{"_manual": true}`) n'ont pas d'URI → restent nulles.
UPDATE "calendly_events"
SET "event_uri" = LEFT("raw_payload" -> 'event' ->> 'uri', 255)
WHERE "raw_payload" -> 'event' ->> 'uri' IS NOT NULL;

UPDATE "calendly_events"
SET "invitee_uri" = LEFT("raw_payload" -> 'invitee' ->> 'uri', 255)
WHERE "raw_payload" -> 'invitee' ->> 'uri' IS NOT NULL;

-- Garde-fou avant l'index unique : si deux lignes portaient la même URI
-- d'invitee (double capture postMessage passée à travers l'ancienne dédup
-- slug+IP+60 s), la création de l'index échouerait et bloquerait le deploy
-- entier. On ne garde l'URI que sur la ligne la plus ancienne du groupe ;
-- les doublons repassent à NULL (rien n'est supprimé, raw_payload reste intact
-- et l'URI y demeure lisible).
UPDATE "calendly_events" AS c
SET "invitee_uri" = NULL
WHERE c."invitee_uri" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "calendly_events" AS older
    WHERE older."invitee_uri" = c."invitee_uri"
      AND (older."captured_at", older."id") < (c."captured_at", c."id")
  );

-- L'unicité est posée APRÈS le backfill. Postgres autorise plusieurs NULL dans
-- un index unique : les lignes manuelles et les captures antérieures sans URI
-- ne s'entre-bloquent pas.
CREATE UNIQUE INDEX "calendly_events_invitee_uri_key" ON "calendly_events"("invitee_uri");
CREATE INDEX "calendly_events_enriched_at_idx" ON "calendly_events"("enriched_at");
