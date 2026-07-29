-- Boîte de réception — accusés de lecture par admin (ADR 0036).
--
-- Table dédiée plutôt qu'une colonne `read_at` sur chacune des 4 tables
-- sources : on ne fait migrer ni `submissions`, ni `job_applications`, ni
-- `podcast_requests` (flux Qualiopi / RH / RGPD) pour un confort d'affichage,
-- l'état reste PAR ADMIN, et un futur canal se branche sans nouvelle migration.
--
-- Purement additif : aucune table existante n'est touchée, aucune donnée
-- déplacée. Absence de ligne = « non lu », ce qui est l'état initial correct
-- pour tout l'historique (rien n'a jamais été marqué lu).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_inbox_entity') THEN
    CREATE TYPE "admin_inbox_entity" AS ENUM (
      'submission',
      'calendly_event',
      'job_application',
      'podcast_request'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "admin_inbox_reads" (
    "id"            UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "entity_type"   "admin_inbox_entity" NOT NULL,
    -- Texte et non UUID : les sources mélangent UUID (Submission,
    -- PodcastRequest) et cuid (CalendlyEvent).
    "entity_id"     VARCHAR(64) NOT NULL,
    "read_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_inbox_reads_pkey" PRIMARY KEY ("id")
);

-- Un admin ne lit une entrée qu'une fois : l'unicité rend le marquage
-- idempotent (upsert), donc rejouable sans risque à chaque ouverture de fiche.
CREATE UNIQUE INDEX IF NOT EXISTS "admin_inbox_reads_admin_entity_key"
  ON "admin_inbox_reads" ("admin_user_id", "entity_type", "entity_id");

-- Index de lecture : le calcul des compteurs interroge toujours
-- « ce que CET admin a lu sur CE canal ».
CREATE INDEX IF NOT EXISTS "admin_inbox_reads_admin_user_id_entity_type_idx"
  ON "admin_inbox_reads" ("admin_user_id", "entity_type");

-- `ON DELETE CASCADE` : supprimer un compte admin efface ses accusés de
-- lecture, qui n'ont aucun sens sans lui (et c'est aussi la bonne réponse RGPD).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_inbox_reads_admin_user_id_fkey'
  ) THEN
    ALTER TABLE "admin_inbox_reads"
      ADD CONSTRAINT "admin_inbox_reads_admin_user_id_fkey"
      FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
