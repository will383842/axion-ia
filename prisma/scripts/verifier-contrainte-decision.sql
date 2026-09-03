-- Éprouver la contrainte `job_applications_motif_coherent_check` DANS LES DEUX SENS.
--
-- Même méthode et même raison que `verifier-contrainte-entretiens.sql` : base
-- jetable, et on REJOUE le DDL de la migration au lieu de le recopier à la main.
-- Une preuve écrite contre une copie de la règle ne prouve que la copie.
--
-- Lancer :
--   docker exec -i -e PGPASSWORD=… <pg> psql -U … -d postgres \
--     -c 'DROP DATABASE IF EXISTS preuve_decision; CREATE DATABASE preuve_decision;'
--   docker exec -i -e PGPASSWORD=… <pg> psql -U … -d preuve_decision \
--     < prisma/scripts/verifier-contrainte-decision.sql

CREATE TYPE "JobApplicationStatus" AS ENUM (
  'new', 'reviewing', 'shortlisted', 'interview', 'offer',
  'rejected', 'withdrawn', 'hired', 'archived'
);
CREATE TYPE "job_rejection_reason" AS ENUM (
  'competences_insuffisantes', 'pretentions_hors_budget', 'hors_zone',
  'profil_hors_cible', 'sans_reponse_candidat', 'absent_entretien',
  'candidat_a_decline', 'poste_pourvu', 'doublon', 'hors_sujet',
  'non_renseigne'
);

CREATE TABLE "job_applications" (
  "id"               UUID                   PRIMARY KEY,
  "status"           "JobApplicationStatus" NOT NULL DEFAULT 'new',
  "rejection_reason" "job_rejection_reason"
);

ALTER TABLE "job_applications"
  ADD CONSTRAINT "job_applications_motif_coherent_check"
  CHECK (
       ("status" IN ('rejected', 'withdrawn') AND "rejection_reason" IS NOT NULL)
    OR ("status" IN ('new', 'reviewing', 'shortlisted', 'interview', 'offer') AND "rejection_reason" IS NULL)
    OR ("status" IN ('hired', 'archived'))
  );

\echo '=== 1) « rejected » SANS motif -> DOIT ETRE REFUSE (la raison d etre du lot)'
INSERT INTO job_applications (id, status) VALUES (gen_random_uuid(), 'rejected');

\echo '=== 2) « withdrawn » SANS motif -> DOIT ETRE REFUSE (le jumeau qu on oublie)'
INSERT INTO job_applications (id, status) VALUES (gen_random_uuid(), 'withdrawn');

\echo '=== 3) « interview » AVEC un motif -> DOIT ETRE REFUSE (le sens inverse)'
INSERT INTO job_applications (id, status, rejection_reason)
VALUES (gen_random_uuid(), 'interview', 'poste_pourvu');

\echo '=== 4) « new » AVEC un motif -> DOIT ETRE REFUSE'
INSERT INTO job_applications (id, status, rejection_reason)
VALUES (gen_random_uuid(), 'new', 'doublon');

\echo '=== 5) retour en arriere : « rejected » motive, puis remis en « offer »'
\echo '        SANS effacer le motif -> DOIT ETRE REFUSE'
INSERT INTO job_applications (id, status, rejection_reason)
VALUES ('55555555-5555-4555-8555-555555555555', 'rejected', 'hors_zone');
UPDATE job_applications SET status = 'offer'
 WHERE id = '55555555-5555-4555-8555-555555555555';

\echo '=== 6) le meme retour en arriere, motif EFFACE -> DOIT PASSER'
UPDATE job_applications SET status = 'offer', rejection_reason = NULL
 WHERE id = '55555555-5555-4555-8555-555555555555';

\echo '=== 7) « rejected » AVEC motif -> DOIT PASSER (temoin : rien n est bloque en bloc)'
INSERT INTO job_applications (id, status, rejection_reason)
VALUES (gen_random_uuid(), 'rejected', 'competences_insuffisantes');

\echo '=== 8) « withdrawn » AVEC motif -> DOIT PASSER'
INSERT INTO job_applications (id, status, rejection_reason)
VALUES (gen_random_uuid(), 'withdrawn', 'candidat_a_decline');

\echo '=== 9) « shortlisted » sans motif -> DOIT PASSER'
INSERT INTO job_applications (id, status) VALUES (gen_random_uuid(), 'shortlisted');

\echo '=== 10) « archived » AVEC motif -> DOIT PASSER : archiver un refus NE DOIT PAS'
\echo '         effacer pourquoi il a ete refuse. C est la zone volontairement libre.'
INSERT INTO job_applications (id, status, rejection_reason)
VALUES (gen_random_uuid(), 'archived', 'poste_pourvu');

\echo '=== BILAN : 5 lignes attendues -> archived 1, offer 1, rejected 1, shortlisted 1, withdrawn 1'
SELECT status, count(*) FROM job_applications GROUP BY status ORDER BY status::text;
