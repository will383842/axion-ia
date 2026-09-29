-- ═════════════════════════════════════════════════════════════════════════════
-- Gate D — COMPORTEMENT du SQL brut du dossier client et de l'enregistrement
-- (chantier visio, PR 2 ; plan §3.3 g).
--
-- Lancé par `.github/workflows/ci.yml` (job gate-d-migration) :
--   psql -v ON_ERROR_STOP=1 -f tests/sql/dossier-client-comportement.sql
--
-- Chaque cas vit dans SA transaction, ANNULÉE à la fin (ROLLBACK) : aucune
-- ligne ne reste, et la vérification « base vide » qui suit reste verte.
--
-- Forme d'un refus attendu :
--   DO $$ BEGIN
--     <instruction qui doit être refusée>;
--     RAISE EXCEPTION 'devait échouer : …' USING ERRCODE = 'AXT99';
--   EXCEPTION WHEN <code attendu> THEN NULL;
--   END $$;
-- `AXT99` n'est attrapé par AUCUN cas : si l'instruction passe, l'exception
-- remonte, `ON_ERROR_STOP` arrête psql, et Gate D rougit. Un refus pour une
-- AUTRE raison que celle attendue (autre code) rougit aussi.
--
-- Codes propres au chantier (voir la migration) : AXV01 contenu immuable,
-- AXV02 journal en ajout seul, AXV03 client de la rencontre, AXV04 client du
-- questionnaire, AXV05 preuve d'accord.
--
-- Mutation qui fait rougir : retirer le trigger `faits_contenu_immuable` de la
-- migration → le cas 1 laisse passer la réécriture → AXT99 → rouge.
-- ═════════════════════════════════════════════════════════════════════════════

\set QUIET on

-- Jeu de données commun, recréé dans chaque transaction (fonction temporaire
-- de session : elle disparaît avec la connexion, rien n'est écrit en base).
CREATE FUNCTION pg_temp.visio_fixture() RETURNS void LANGUAGE sql AS $$
  INSERT INTO clients (id, numero, raison_sociale, updated_at) VALUES
    ('00000000-0000-4000-8000-00000000000a', 'AXI-CLI-VISIO-A', 'Client fictif A', now()),
    ('00000000-0000-4000-8000-00000000000b', 'AXI-CLI-VISIO-B', 'Client fictif B', now());
  INSERT INTO projets (id, numero, client_id, titre, updated_at) VALUES
    ('00000000-0000-4000-8000-00000000001a', 'AXI-PRJ-2099-001', '00000000-0000-4000-8000-00000000000a', 'Projet fictif A', now()),
    ('00000000-0000-4000-8000-00000000001b', 'AXI-PRJ-2099-002', '00000000-0000-4000-8000-00000000000b', 'Projet fictif B', now());
  INSERT INTO client_contacts (id, client_id, nom, origine, updated_at) VALUES
    ('00000000-0000-4000-8000-00000000002a', '00000000-0000-4000-8000-00000000000a', 'Personne fictive A', 'saisie', now()),
    ('00000000-0000-4000-8000-00000000002b', '00000000-0000-4000-8000-00000000000b', 'Personne fictive B', 'saisie', now());
  INSERT INTO rencontres (id, source, type, titre, client_id, rattachement_statut, updated_at) VALUES
    ('00000000-0000-4000-8000-00000000003a', 'saisie_manuelle', 'visio', 'Rendez-vous fictif', '00000000-0000-4000-8000-00000000000a', 'valide', now());
  INSERT INTO questionnaires_cadrage (id, projet_id, client_id, version, mode, statut, genere_le) VALUES
    ('00000000-0000-4000-8000-00000000004a', '00000000-0000-4000-8000-00000000001a', '00000000-0000-4000-8000-00000000000a', 1, 'a_copier', 'brouillon', now());
  INSERT INTO questionnaire_questions (id, questionnaire_id, ordre, texte, type_vise) VALUES
    ('00000000-0000-4000-8000-00000000005a', '00000000-0000-4000-8000-00000000004a', 1, 'enc:v1:question', 'budget');
  INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, rencontre_id, constate_le) VALUES
    ('00000000-0000-4000-8000-00000000006a', '00000000-0000-4000-8000-00000000000a', 'entreprise', 'besoin', 'global', 'enc:v1:enonce', 'dit_explicitement', 'haute', 'transcription', '00000000-0000-4000-8000-00000000003a', now());
  INSERT INTO appareils_enregistrement (id, nom, jeton_hash, admin_user_id, expire_le) VALUES
    ('00000000-0000-4000-8000-00000000007a', 'Poste fictif', repeat('a', 64), '00000000-0000-4000-8000-0000000000ff', now() + interval '90 days');
  INSERT INTO enregistrements (id, rencontre_id, nature, cle_client, appareil_id, statut, debut, evenements, version_extension, version_contrat, updated_at) VALUES
    ('00000000-0000-4000-8000-00000000008a', '00000000-0000-4000-8000-00000000003a', 'visio', '00000000-0000-4000-8000-00000000009a', '00000000-0000-4000-8000-00000000007a', 'en_cours', now(), '[]', '1.0.0', 1, now());
$$;

\echo '[visio] 1. le contenu d''un fait est immuable ; le rattachement ne l''est pas'
BEGIN;
SELECT pg_temp.visio_fixture();
DO $$ BEGIN
  UPDATE faits SET enonce = 'enc:v1:autre' WHERE id = '00000000-0000-4000-8000-00000000006a';
  RAISE EXCEPTION 'devait échouer : réécriture de l''énoncé acceptée' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV01' THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE faits SET citation = 'enc:v1:citation-inventee' WHERE id = '00000000-0000-4000-8000-00000000006a';
  RAISE EXCEPTION 'devait échouer : ajout d''une citation accepté' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV01' THEN NULL;
END $$;
-- Contre-témoin : le statut change librement.
UPDATE faits SET statut = 'valide' WHERE id = '00000000-0000-4000-8000-00000000006a';
ROLLBACK;

\echo '[visio] 2. sous le drapeau d''effacement, le contenu se vide'
BEGIN;
SELECT pg_temp.visio_fixture();
SET LOCAL axion.effacement_rgpd = 'on';
UPDATE faits SET enonce = '', statut = 'efface' WHERE id = '00000000-0000-4000-8000-00000000006a';
DO $$ BEGIN
  IF (SELECT enonce FROM faits WHERE id = '00000000-0000-4000-8000-00000000006a') <> '' THEN
    RAISE EXCEPTION 'l''effacement sous drapeau n''a pas vidé l''énoncé' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

\echo '[visio] 3. les journaux sont en ajout seul'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO fait_evenements (id, fait_id, action) VALUES
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000006a', 'propose');
INSERT INTO effacements_journal (id, table_cible, ligne_id, motif) VALUES
  ('00000000-0000-4000-8000-0000000000e2', 'faits', 'x', 'pilote');
DO $$ BEGIN
  DELETE FROM fait_evenements WHERE id = '00000000-0000-4000-8000-0000000000e1';
  RAISE EXCEPTION 'devait échouer : suppression dans fait_evenements' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV02' THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE fait_evenements SET action = 'valide' WHERE id = '00000000-0000-4000-8000-0000000000e1';
  RAISE EXCEPTION 'devait échouer : modification dans fait_evenements' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV02' THEN NULL;
END $$;
DO $$ BEGIN
  DELETE FROM effacements_journal WHERE id = '00000000-0000-4000-8000-0000000000e2';
  RAISE EXCEPTION 'devait échouer : suppression dans effacements_journal' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV02' THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 4. un seul compte rendu validé, un seul en cours, un contenu effacé reste vide'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO comptes_rendus (id, rencontre_id, version, origine, statut, schema_version, contenu) VALUES
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-00000000003a', 1, 'manuel', 'valide', 1, 'enc:v1:cr1'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-00000000003a', 2, 'manuel', 'brouillon', 1, 'enc:v1:cr2');
DO $$ BEGIN
  INSERT INTO comptes_rendus (id, rencontre_id, version, origine, statut, schema_version, contenu) VALUES
    ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-00000000003a', 3, 'manuel', 'valide', 1, 'enc:v1:cr3');
  RAISE EXCEPTION 'devait échouer : second compte rendu validé' USING ERRCODE = 'AXT99';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO comptes_rendus (id, rencontre_id, version, origine, statut, schema_version, contenu) VALUES
    ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-00000000003a', 4, 'manuel', 'a_valider', 1, 'enc:v1:cr4');
  RAISE EXCEPTION 'devait échouer : second compte rendu en cours' USING ERRCODE = 'AXT99';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE comptes_rendus SET statut = 'a_regenerer' WHERE id = '00000000-0000-4000-8000-0000000000c1';
  RAISE EXCEPTION 'devait échouer : à régénérer avec son contenu' USING ERRCODE = 'AXT99';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 5. un fait « à ranger » ne se valide pas'
BEGIN;
SELECT pg_temp.visio_fixture();
DO $$ BEGIN
  INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, constate_le, statut) VALUES
    ('00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-00000000000a', 'a_ranger', 'besoin', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'saisie_manuelle', now(), 'valide');
  RAISE EXCEPTION 'devait échouer : fait à ranger validé' USING ERRCODE = 'AXT99';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 6. un fait ne se range pas dans le projet d''un autre client'
BEGIN;
SELECT pg_temp.visio_fixture();
DO $$ BEGIN
  INSERT INTO faits (id, client_id, portee, projet_id, type, cle, enonce, certitude, confiance, source, constate_le) VALUES
    ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-00000000000a', 'projet', '00000000-0000-4000-8000-00000000001b', 'besoin', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'saisie_manuelle', now());
  RAISE EXCEPTION 'devait échouer : fait dans le projet d''un autre client' USING ERRCODE = 'AXT99';
EXCEPTION WHEN foreign_key_violation THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO questionnaires_cadrage (id, projet_id, client_id, version, mode, statut, genere_le) VALUES
    ('00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-00000000001b', '00000000-0000-4000-8000-00000000000a', 1, 'a_copier', 'brouillon', now());
  RAISE EXCEPTION 'devait échouer : questionnaire sur le projet d''un autre client' USING ERRCODE = 'AXT99';
EXCEPTION WHEN foreign_key_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 7. un seul enregistrement actif par rencontre'
BEGIN;
SELECT pg_temp.visio_fixture();
DO $$ BEGIN
  INSERT INTO enregistrements (id, rencontre_id, nature, cle_client, appareil_id, statut, debut, evenements, version_extension, version_contrat, updated_at) VALUES
    ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000003a', 'visio', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000007a', 'accord_en_attente', now(), '[]', '1.0.0', 1, now());
  RAISE EXCEPTION 'devait échouer : second enregistrement actif' USING ERRCODE = 'AXT99';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
-- Contre-témoin : un enregistrement terminé coexiste avec l'actif.
INSERT INTO enregistrements (id, rencontre_id, nature, cle_client, appareil_id, statut, debut, evenements, version_extension, version_contrat, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000003a', 'visio', '00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-00000000007a', 'valide', now(), '[]', '1.0.0', 1, now());
ROLLBACK;

\echo '[visio] 8. une réponse de questionnaire garde sa question source, et elle seule'
BEGIN;
SELECT pg_temp.visio_fixture();
DO $$ BEGIN
  INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, constate_le) VALUES
    ('00000000-0000-4000-8000-0000000000f8', '00000000-0000-4000-8000-00000000000a', 'entreprise', 'budget', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'questionnaire_cadrage', now());
  RAISE EXCEPTION 'devait échouer : fait de questionnaire sans question' USING ERRCODE = 'AXT99';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, constate_le, questionnaire_question_id) VALUES
    ('00000000-0000-4000-8000-0000000000f9', '00000000-0000-4000-8000-00000000000a', 'entreprise', 'budget', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'transcription', now(), '00000000-0000-4000-8000-00000000005a');
  RAISE EXCEPTION 'devait échouer : question source sur un fait qui n''en vient pas' USING ERRCODE = 'AXT99';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 9. une question qui a produit un fait ne se supprime pas'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, constate_le, questionnaire_question_id) VALUES
  ('00000000-0000-4000-8000-0000000000fa', '00000000-0000-4000-8000-00000000000a', 'entreprise', 'budget', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'questionnaire_cadrage', now(), '00000000-0000-4000-8000-00000000005a');
DO $$ BEGIN
  DELETE FROM questionnaire_questions WHERE id = '00000000-0000-4000-8000-00000000005a';
  RAISE EXCEPTION 'devait échouer : question source supprimée' USING ERRCODE = 'AXT99';
EXCEPTION WHEN foreign_key_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 10. une rencontre saisie naît sur une fiche client validée'
BEGIN;
SELECT pg_temp.visio_fixture();
DO $$ BEGIN
  INSERT INTO rencontres (id, source, type, titre, updated_at) VALUES
    ('00000000-0000-4000-8000-0000000000d1', 'saisie_manuelle', 'visio', 'Sans fiche', now());
  RAISE EXCEPTION 'devait échouer : rencontre saisie sans client' USING ERRCODE = 'AXT99';
EXCEPTION WHEN check_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 11. la purge d''un rendez-vous Calendly laisse le suivi de la rencontre intact'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO calendly_events (id, event_type_name, event_type_slug, raw_payload, updated_at) VALUES
  ('visio-gate-d-calendly-1', 'Rendez-vous fictif', 'fictif', '{}', now());
INSERT INTO rencontres (id, source, type, titre, calendly_event_id, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000d2', 'calendly', 'visio', 'Rendez-vous Calendly fictif', 'visio-gate-d-calendly-1', now());
INSERT INTO rencontre_suivis (rencontre_id, issue, updated_at) VALUES
  ('00000000-0000-4000-8000-0000000000d2', 'eu_lieu', now());
DELETE FROM calendly_events WHERE id = 'visio-gate-d-calendly-1';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM rencontre_suivis WHERE rencontre_id = '00000000-0000-4000-8000-0000000000d2') THEN
    RAISE EXCEPTION 'le suivi a disparu avec le rendez-vous Calendly' USING ERRCODE = 'AXT99';
  END IF;
  IF (SELECT calendly_event_id FROM rencontres WHERE id = '00000000-0000-4000-8000-0000000000d2') IS NOT NULL THEN
    RAISE EXCEPTION 'le lien Calendly n''a pas été détaché' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

\echo '[visio] 12. deux transcriptions de même empreinte, ou deux retenues, sont refusées'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO transcriptions (id, enregistrement_id, version, modele, statut, langue, empreinte_entree) VALUES
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-00000000008a', 1, 'modele-fictif', 'retenue', 'fr', repeat('e', 64));
DO $$ BEGIN
  INSERT INTO transcriptions (id, enregistrement_id, version, modele, statut, langue, empreinte_entree) VALUES
    ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-00000000008a', 2, 'modele-fictif', 'obtenue', 'fr', repeat('e', 64));
  RAISE EXCEPTION 'devait échouer : même empreinte transcrite deux fois' USING ERRCODE = 'AXT99';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO transcriptions (id, enregistrement_id, version, modele, statut, langue, empreinte_entree) VALUES
    ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-00000000008a', 3, 'modele-fictif', 'retenue', 'fr', repeat('f', 64));
  RAISE EXCEPTION 'devait échouer : deux transcriptions retenues' USING ERRCODE = 'AXT99';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 13. une preuve d''accord ne se modifie ni ne se supprime, et survit au son'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO enregistrement_consentements (id, enregistrement_id, rencontre_id, type, version_texte, survenu_le) VALUES
  ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-4000-8000-00000000008a', '00000000-0000-4000-8000-00000000003a', 'declaration_axion', 'v1', now());
DO $$ BEGIN
  UPDATE enregistrement_consentements SET version_texte = 'v2' WHERE id = '00000000-0000-4000-8000-0000000000a9';
  RAISE EXCEPTION 'devait échouer : preuve d''accord modifiée' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV05' THEN NULL;
END $$;
DO $$ BEGIN
  DELETE FROM enregistrement_consentements WHERE id = '00000000-0000-4000-8000-0000000000a9';
  RAISE EXCEPTION 'devait échouer : preuve d''accord supprimée' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV05' THEN NULL;
END $$;
-- La suppression de l'enregistrement DÉTACHE la preuve (clé SetNull) : admis.
DELETE FROM enregistrements WHERE id = '00000000-0000-4000-8000-00000000008a';
DO $$ BEGIN
  IF (SELECT enregistrement_id FROM enregistrement_consentements WHERE id = '00000000-0000-4000-8000-0000000000a9') IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM enregistrement_consentements WHERE id = '00000000-0000-4000-8000-0000000000a9') THEN
    RAISE EXCEPTION 'la preuve d''accord n''a pas survécu au son' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

\echo '[visio] 14. un fait appartient au client de sa rencontre (fin de transaction)'
BEGIN;
SELECT pg_temp.visio_fixture();
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
  INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, rencontre_id, constate_le) VALUES
    ('00000000-0000-4000-8000-0000000000fb', '00000000-0000-4000-8000-00000000000b', 'entreprise', 'besoin', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'transcription', '00000000-0000-4000-8000-00000000003a', now());
  RAISE EXCEPTION 'devait échouer : fait chez un autre client que sa rencontre' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV03' THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE rencontres SET client_id = '00000000-0000-4000-8000-00000000000b' WHERE id = '00000000-0000-4000-8000-00000000003a';
  RAISE EXCEPTION 'devait échouer : rencontre déplacée sans ses faits' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV03' THEN NULL;
END $$;
ROLLBACK;

-- Contre-témoin : déplacer la rencontre ET ses faits dans la même transaction passe.
BEGIN;
SELECT pg_temp.visio_fixture();
DELETE FROM enregistrements WHERE id = '00000000-0000-4000-8000-00000000008a';
UPDATE rencontres SET client_id = '00000000-0000-4000-8000-00000000000b' WHERE id = '00000000-0000-4000-8000-00000000003a';
UPDATE faits SET client_id = '00000000-0000-4000-8000-00000000000b' WHERE rencontre_id = '00000000-0000-4000-8000-00000000003a';
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;

\echo '[visio] 15. un fait issu d''une réponse appartient au client du questionnaire'
BEGIN;
SELECT pg_temp.visio_fixture();
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
  INSERT INTO faits (id, client_id, portee, type, cle, enonce, certitude, confiance, source, constate_le, questionnaire_question_id) VALUES
    ('00000000-0000-4000-8000-0000000000fc', '00000000-0000-4000-8000-00000000000b', 'entreprise', 'budget', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'questionnaire_cadrage', now(), '00000000-0000-4000-8000-00000000005a');
  RAISE EXCEPTION 'devait échouer : réponse rangée chez un autre client' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV04' THEN NULL;
END $$;
ROLLBACK;

\echo '[visio] 16. fusion (A3) : projet puis personne déplacés, clés composées différées'
BEGIN;
SELECT pg_temp.visio_fixture();
-- Le cas ordinaire : un fait porte À LA FOIS un projet et une personne-sujet.
INSERT INTO faits (id, client_id, portee, projet_id, contact_sujet_id, type, cle, enonce, certitude, confiance, source, constate_le) VALUES
  ('00000000-0000-4000-8000-0000000000fd', '00000000-0000-4000-8000-00000000000a', 'projet', '00000000-0000-4000-8000-00000000001a', '00000000-0000-4000-8000-00000000002a', 'besoin', 'global', 'enc:v1:x', 'dit_explicitement', 'haute', 'saisie_manuelle', now());
-- Témoin : clés contrôlées à l'instant (le défaut) → déplacer le projet
-- recopie client_id sur le fait, dont la personne est encore sur l'ancienne
-- fiche : refusé à mi-chemin.
DO $$ BEGIN
  UPDATE projets SET client_id = '00000000-0000-4000-8000-00000000000b' WHERE id = '00000000-0000-4000-8000-00000000001a';
  RAISE EXCEPTION 'devait échouer : clé composée immédiate contournée' USING ERRCODE = 'AXT99';
EXCEPTION WHEN foreign_key_violation THEN NULL;
END $$;
-- La fusion diffère les clés, déplace le projet PUIS la personne, et tout est
-- contrôlé d'un coup (SET CONSTRAINTS ALL IMMEDIATE = ce que ferait le COMMIT).
SET CONSTRAINTS ALL DEFERRED;
UPDATE projets SET client_id = '00000000-0000-4000-8000-00000000000b' WHERE id = '00000000-0000-4000-8000-00000000001a';
UPDATE client_contacts SET client_id = '00000000-0000-4000-8000-00000000000b' WHERE id = '00000000-0000-4000-8000-00000000002a';
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ BEGIN
  IF (SELECT client_id FROM faits WHERE id = '00000000-0000-4000-8000-0000000000fd') <> '00000000-0000-4000-8000-00000000000b'
     OR (SELECT client_id FROM questionnaires_cadrage WHERE id = '00000000-0000-4000-8000-00000000004a') <> '00000000-0000-4000-8000-00000000000b' THEN
    RAISE EXCEPTION 'la fusion n''a pas fait suivre le fait et le questionnaire' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

\echo '[visio] 17. une étape sans compte rendu n''existe qu''une fois par rencontre'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO traitements_visio (id, rencontre_id, etape) VALUES
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-00000000003a', 'transcrire');
DO $$ BEGIN
  INSERT INTO traitements_visio (id, rencontre_id, etape) VALUES
    ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-00000000003a', 'transcrire');
  RAISE EXCEPTION 'devait échouer : étape sans compte rendu lancée deux fois' USING ERRCODE = 'AXT99';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
-- Contre-témoin : la même étape pour deux comptes rendus distincts, et une
-- fois sans compte rendu, coexistent.
INSERT INTO traitements_visio (id, rencontre_id, etape, compte_rendu_id) VALUES
  ('00000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-00000000003a', 'rediger', '00000000-0000-4000-8000-0000000000c7'),
  ('00000000-0000-4000-8000-0000000000e8', '00000000-0000-4000-8000-00000000003a', 'rediger', '00000000-0000-4000-8000-0000000000c8'),
  ('00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-00000000003a', 'rediger', NULL);
ROLLBACK;

\echo '[visio] 18. sous le drapeau d''effacement, un journal se vide mais ne se supprime pas'
BEGIN;
SELECT pg_temp.visio_fixture();
INSERT INTO projet_evenements (id, projet_id, action, motif) VALUES
  ('00000000-0000-4000-8000-0000000000ea', '00000000-0000-4000-8000-00000000001a', 'renomme', 'Motif qui nomme une personne fictive');
SET LOCAL axion.effacement_rgpd = 'on';
UPDATE projet_evenements SET motif = NULL WHERE id = '00000000-0000-4000-8000-0000000000ea';
DO $$ BEGIN
  DELETE FROM projet_evenements WHERE id = '00000000-0000-4000-8000-0000000000ea';
  RAISE EXCEPTION 'devait échouer : suppression dans un journal sous le drapeau' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXV02' THEN NULL;
END $$;
DO $$ BEGIN
  IF (SELECT motif FROM projet_evenements WHERE id = '00000000-0000-4000-8000-0000000000ea') IS NOT NULL THEN
    RAISE EXCEPTION 'le motif n''a pas été vidé sous le drapeau' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

\echo '[visio] 19. rien n''est resté en base'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM clients WHERE numero LIKE 'AXI-CLI-VISIO-%')
     OR EXISTS (SELECT 1 FROM faits)
     OR EXISTS (SELECT 1 FROM rencontres)
     OR EXISTS (SELECT 1 FROM traitements_visio)
     OR EXISTS (SELECT 1 FROM projet_evenements) THEN
    RAISE EXCEPTION 'une ligne de test a survécu à son ROLLBACK' USING ERRCODE = 'AXT99';
  END IF;
END $$;

\echo '[visio] comportement SQL : 19 cas passés'
