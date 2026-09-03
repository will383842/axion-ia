-- Éprouver la contrainte `job_interviews_etat_coherent_check` DANS LES DEUX SENS.
--
-- Base jetable : la base de développement partagée est vidée par d'autres
-- sessions pendant que je travaille. Une preuve qui dépend d'un substrat qu'on
-- ne contrôle pas n'est pas une preuve.
--
-- On ne recopie PAS la contrainte ici : on rejoue le DDL de la migration.

CREATE TABLE job_applications (id UUID PRIMARY KEY);
CREATE TABLE admin_users (id UUID PRIMARY KEY);
INSERT INTO job_applications (id) VALUES ('11111111-1111-4111-8111-111111111111');

CREATE TYPE "job_interview_mode" AS ENUM ('telephone', 'visio', 'sur_site');
CREATE TYPE "job_interview_state" AS ENUM ('planifie', 'tenu', 'annule', 'absent');
CREATE TYPE "job_interview_outcome" AS ENUM (
  'poursuivre', 'second_tour', 'proposition', 'ecarter', 'sans_suite'
);

CREATE TABLE "job_interviews" (
  "id"                 UUID                    NOT NULL,
  "application_id"     UUID                    NOT NULL,
  "round"              INTEGER                 NOT NULL DEFAULT 1,
  "mode"               "job_interview_mode"    NOT NULL,
  "scheduled_at"       TIMESTAMP(3)            NOT NULL,
  "duration_min"       INTEGER,
  "location"           VARCHAR(500),
  "conducted_by_id"    UUID,
  "conducted_by_name"  VARCHAR(255)            NOT NULL,
  "state"              "job_interview_state"   NOT NULL DEFAULT 'planifie',
  "held_at"            TIMESTAMP(3),
  "debrief"            TEXT,
  "outcome"            "job_interview_outcome",
  "calendly_event_id"  TEXT,
  "rappel_j1_envoye_at" TIMESTAMP(3),
  "rappel_h1_envoye_at" TIMESTAMP(3),
  "created_at"         TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3)            NOT NULL,
  CONSTRAINT "job_interviews_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "job_interviews"
  ADD CONSTRAINT "job_interviews_etat_coherent_check"
  CHECK (
       (state = 'tenu'  AND held_at IS NOT NULL AND debrief IS NOT NULL AND outcome IS NOT NULL)
    OR (state <> 'tenu' AND held_at IS NULL)
  );

\set APP '11111111-1111-4111-8111-111111111111'

\echo '=== 1) « tenu » SANS compte rendu -> DOIT ETRE REFUSE'
INSERT INTO job_interviews (id, application_id, mode, scheduled_at, conducted_by_name, state, held_at, updated_at)
VALUES (gen_random_uuid(), :'APP', 'visio', now(), 'Recette', 'tenu', now(), now());

\echo '=== 2) « tenu » avec compte rendu mais SANS issue -> DOIT ETRE REFUSE'
INSERT INTO job_interviews (id, application_id, mode, scheduled_at, conducted_by_name, state, held_at, debrief, updated_at)
VALUES (gen_random_uuid(), :'APP', 'visio', now(), 'Recette', 'tenu', now(), 'Compte rendu', now());

\echo '=== 3) « annule » AVEC une date de tenue -> DOIT ETRE REFUSE (le jumeau oublie)'
INSERT INTO job_interviews (id, application_id, mode, scheduled_at, conducted_by_name, state, held_at, updated_at)
VALUES (gen_random_uuid(), :'APP', 'visio', now(), 'Recette', 'annule', now(), now());

\echo '=== 4) « absent » AVEC une date de tenue -> DOIT ETRE REFUSE'
INSERT INTO job_interviews (id, application_id, mode, scheduled_at, conducted_by_name, state, held_at, updated_at)
VALUES (gen_random_uuid(), :'APP', 'visio', now(), 'Recette', 'absent', now(), now());

\echo '=== 5) « planifie » simple -> DOIT PASSER (temoin: la contrainte ne bloque pas tout)'
INSERT INTO job_interviews (id, application_id, mode, scheduled_at, conducted_by_name, state, updated_at)
VALUES (gen_random_uuid(), :'APP', 'visio', now(), 'Recette', 'planifie', now());

\echo '=== 6) « tenu » COMPLET -> DOIT PASSER'
INSERT INTO job_interviews (id, application_id, mode, scheduled_at, conducted_by_name, state, held_at, debrief, outcome, updated_at)
VALUES (gen_random_uuid(), :'APP', 'visio', now(), 'Recette', 'tenu', now(), 'Il connait le secteur.', 'second_tour', now());

\echo '=== BILAN : 2 lignes attendues (les cas 5 et 6)'
SELECT state, count(*) FROM job_interviews GROUP BY state ORDER BY state;
