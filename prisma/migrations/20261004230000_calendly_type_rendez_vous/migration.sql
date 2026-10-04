-- Chantier « Types de rendez-vous », lot L1 (2026-10-04).
--
-- Le compte Calendly unique porte plusieurs types de rendez-vous (diagnostic,
-- échange projet, apporteur, salon). Jusqu'ici le type se devinait à chaque
-- lecture par un mot-clé dans le NOM ; il est désormais classé UNE fois à
-- l'écriture (`src/server/calendly/type-rendez-vous.ts`) et rangé ici.
--
-- AJOUTS SEULS : un type énuméré, trois colonnes NULLABLES sans défaut, un
-- index. Aucune colonne modifiée, aucune ligne supprimée. Idempotente : peut
-- être rejouée sans effet (IF NOT EXISTS, reprises bornées à `IS NULL`).
--
-- Fenêtre app/worker : le worker (sondage Calendly) peut tourner avec le
-- nouveau code AVANT que cette migration passe. Ses écritures retombent alors
-- sans les nouvelles colonnes (`sansColonnesTypeRendezVous`), et
-- l'enrichissement suivant les remplit.

-- 1. Le type énuméré.
DO $$
BEGIN
  CREATE TYPE "type_rendez_vous" AS ENUM ('diagnostic', 'echange_projet', 'apporteur', 'salon', 'autre');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2. Les colonnes.
ALTER TABLE "calendly_events" ADD COLUMN IF NOT EXISTS "type_rendez_vous" "type_rendez_vous";
ALTER TABLE "calendly_events" ADD COLUMN IF NOT EXISTS "event_type_uri" VARCHAR(255);
ALTER TABLE "calendly_events" ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "calendly_events_type_rendez_vous_idx"
  ON "calendly_events" ("type_rendez_vous");

-- 3. Reprise de l'URI du type depuis la charge brute.
--
-- Formes réellement stockées dans `raw_payload` selon le chemin :
--   · sondage (api_poll), avant enrichissement : le `scheduled_event` lui-même
--     → `raw_payload.event_type` ;
--   · toute ligne enrichie (sondage comme iframe) : `{ invitee, event, … }`
--     → `raw_payload.event.event_type` ;
--   · iframe (embed_js) non enrichie : `{ event: { uri }, invitee: { uri } }`,
--     aucune URI de type ; saisie manuelle : `{ _manual: true }` — rien à reprendre.
-- Seule une URI de l'API Calendly est recopiée.
UPDATE "calendly_events"
SET "event_type_uri" = src.uri
FROM (
  SELECT "id",
         COALESCE(
           CASE WHEN jsonb_typeof("raw_payload" -> 'event') = 'object'
                THEN "raw_payload" -> 'event' ->> 'event_type' END,
           CASE WHEN jsonb_typeof("raw_payload" -> 'event_type') = 'string'
                THEN "raw_payload" ->> 'event_type' END
         ) AS uri
  FROM "calendly_events"
  WHERE "event_type_uri" IS NULL
    AND jsonb_typeof("raw_payload") = 'object'
) AS src
WHERE "calendly_events"."id" = src."id"
  AND src.uri LIKE 'https://api.calendly.com/event_types/%'
  AND length(src.uri) <= 255;

-- 4. Reprise du type par le NOM — mêmes règles, dans le même ordre, que
-- `classerParNom` (type-rendez-vous.ts) :
--   « apporteur »                                   → apporteur
--   « salon » (sans « apporteur »)                  → salon
--   « diagnostic »                                  → diagnostic
--   « discutons de votre projet », « échange projet »,
--   « premier contact » (slug de l'iframe)          → echange_projet
--   sinon                                           → autre
-- Nom normalisé : minuscules, accents retirés, tirets et espaces resserrés.
-- Les lignes à venir seront reclassées par l'URI à chaque enrichissement.
UPDATE "calendly_events" AS ce
SET "type_rendez_vous" = (
  CASE
    WHEN n.nom LIKE '%apporteur%' THEN 'apporteur'
    WHEN n.nom LIKE '%salon%' THEN 'salon'
    WHEN n.nom LIKE '%diagnostic%' THEN 'diagnostic'
    WHEN n.nom LIKE '%discutons de votre projet%'
      OR n.nom LIKE '%echange projet%'
      OR n.nom LIKE '%premier contact%' THEN 'echange_projet'
    ELSE 'autre'
  END
)::"type_rendez_vous"
FROM (
  SELECT "id",
         trim(regexp_replace(
           translate(lower("event_type_name"),
                     'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœ-_',
                     'aaaaaaceeeeiiiinooooouuuuyyo  '),
           '\s+', ' ', 'g')) AS nom
  FROM "calendly_events"
  WHERE "type_rendez_vous" IS NULL
) AS n
WHERE ce."id" = n."id";
