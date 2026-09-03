-- Lot 2 — LES ENTRETIENS (2026-09-03)
--
-- Le défaut fermé : sur les 461 modèles de ce schéma, aucun ne décrivait un
-- entretien. La date, le compte rendu, qui l'a mené, l'absence du candidat, le
-- second tour — rien n'était enregistrable. C'est pourtant là que se prend la
-- décision. Constat `T2` de l'audit.
--
-- Et `calendly_events` savait pointer une demande commerciale et rien d'autre :
-- un rendez-vous pris par un candidat ne rejoignait aucun dossier, alors qu'il
-- portait déjà sa date, son lieu, son lien de visio, son état et ses notes.
--
-- 🛑 ORDRE PERMANENT — AUCUN ENREGISTREMENT. Ni captation audio, ni vidéo, ni
-- transcription, ni résumé automatique. Le compte rendu est SAISI. Cette table
-- ne porte aucun champ de média et ne doit jamais en gagner un.
--
-- Additif : aucune ligne existante n'est touchée.

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

CREATE UNIQUE INDEX "job_interviews_calendly_event_id_key"
  ON "job_interviews" ("calendly_event_id");

CREATE INDEX "job_interviews_application_id_scheduled_at_idx"
  ON "job_interviews" ("application_id", "scheduled_at");

CREATE INDEX "job_interviews_state_scheduled_at_idx"
  ON "job_interviews" ("state", "scheduled_at");

ALTER TABLE "job_interviews"
  ADD CONSTRAINT "job_interviews_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "job_applications"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_interviews"
  ADD CONSTRAINT "job_interviews_conducted_by_id_fkey"
  FOREIGN KEY ("conducted_by_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── LA CONTRAINTE, ET ELLE DIT LES DEUX SENS ────────────────────────────────
--
-- 🔑 Même idiome que `enrollments_sortie_coherente_check`, et pour la même
-- raison. Un entretien « tenu » sans compte rendu ni issue est un entretien
-- dont il ne reste RIEN : la case est cochée, la décision est invisible, et six
-- mois plus tard personne ne sait pourquoi ce candidat a été écarté.
--
-- Et le sens inverse compte autant : un entretien annulé qui porterait une date
-- de tenue laisserait une trace fantôme que les rapports liraient comme un
-- entretien réel. C'est le défaut jumeau, celui qu'on oublie de garder.
--
-- `absent` (le candidat ne s'est pas présenté) suit la règle des non-tenus : il
-- n'y a pas eu d'entretien, donc pas d'heure de tenue. Le fait qu'il ne soit pas
-- venu se lit dans l'état, pas dans une date.
ALTER TABLE "job_interviews"
  ADD CONSTRAINT "job_interviews_etat_coherent_check"
  CHECK (
       (state = 'tenu'  AND held_at IS NOT NULL AND debrief IS NOT NULL AND outcome IS NOT NULL)
    OR (state <> 'tenu' AND held_at IS NULL)
  );

COMMENT ON TABLE "job_interviews" IS
  'Entretiens avec un candidat. AUCUN enregistrement : ni audio, ni vidéo, ni transcription, ni résumé automatique — ordre permanent du responsable de traitement. Le compte rendu est saisi à la main.';

COMMENT ON COLUMN "job_interviews"."held_at" IS
  'Quand l''entretien a EU LIEU, distinct de scheduled_at : un entretien décalé de vingt minutes reste le même entretien, et c''est l''heure réelle qui compte pour relire un dossier.';

COMMENT ON COLUMN "job_interviews"."rappel_j1_envoye_at" IS
  'Marqueur d''idempotence. Posé UNIQUEMENT si la mise en file a réussi : enqueueEmail ne lève pas, elle rend { enqueued }, et écrire « envoyé » sur un retour faux interdit le rattrapage.';

-- ── Le lien qui manquait, miroir de linked_submission_id ────────────────────
--
-- SET NULL et non CASCADE : effacer une candidature ne doit pas effacer le
-- rendez-vous de l'agenda, qui a sa propre vie et sa propre durée de rétention
-- (36 mois, alignée sur la notice publiée).

ALTER TABLE "calendly_events"
  ADD COLUMN "linked_job_application_id" UUID;

ALTER TABLE "calendly_events"
  ADD CONSTRAINT "calendly_events_linked_job_application_id_fkey"
  FOREIGN KEY ("linked_job_application_id") REFERENCES "job_applications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "calendly_events_linked_job_application_id_idx"
  ON "calendly_events" ("linked_job_application_id");

COMMENT ON COLUMN "calendly_events"."linked_job_application_id" IS
  'Candidature à laquelle ce rendez-vous se rattache. Miroir de linked_submission_id, qui n''existait que pour les demandes commerciales : un rendez-vous pris par un candidat ne rejoignait aucun dossier.';

-- ── Le type d'événement qui manquait au journal ──────────────────────────────
--
-- Annuler un entretien, ou constater que le candidat n'est pas venu, se
-- consignait faute de mieux sous `entretien_planifie` : la frise aurait affiché
-- « Entretien planifié » au-dessus d'un résumé disant « Entretien annulé ». Un
-- libellé qui se contredit se lit deux fois avant qu'on comprenne, et une fois
-- de trop.
--
-- ⚠️ Cette valeur n'est PAS utilisée dans cette migration, et ne peut pas
-- l'être : Postgres refuse d'employer une valeur ajoutée par ALTER TYPE dans la
-- transaction qui l'ajoute. Elle est écrite par le code applicatif, après.
ALTER TYPE "job_application_event_type" ADD VALUE IF NOT EXISTS 'entretien_sans_suite';
