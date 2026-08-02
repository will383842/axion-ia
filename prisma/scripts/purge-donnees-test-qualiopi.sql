-- ============================================================================
-- Qualiopi — Purge des données de TEST saisies dans la vraie numérotation.
--
-- POURQUOI CETTE VERSION SQL EN PLUS DU SCRIPT TypeScript
-- -------------------------------------------------------
-- `purge-donnees-test-qualiopi.ts` est la version lisible et testable, mais
-- elle a besoin de `tsx` — une devDependency ABSENTE de l'image de production
-- (le stage `runner` du Dockerfile ne copie que `.next/standalone`, le CLI
-- Prisma et le dossier `prisma/`). Elle n'est donc pas exécutable sur le VPS.
--
-- Ce fichier fait le même travail avec le seul outil réellement disponible en
-- production : `psql`, dans le conteneur Postgres.
--
-- SÉCURITÉ : tout est dans UNE transaction.
--   • par défaut le script se termine par ROLLBACK  → SIMULATION, rien n'est
--     écrit, mais tous les décomptes sont affichés ;
--   • pour exécuter réellement, remplacer le ROLLBACK final par COMMIT.
-- Une erreur de clé étrangère annule l'ensemble : jamais de suppression
-- partielle qui laisserait la base incohérente.
--
-- USAGE
--   docker exec -i <conteneur postgres> psql -U axionia -d axionia \
--     < prisma/scripts/purge-donnees-test-qualiopi.sql
--
-- CE QUI EST CONSERVÉ, ET POURQUOI
--   • AXI-SESS-2026-003 (INVEST SUN) et tout ce qui s'y rattache ;
--   • AXI-CLI-003 INVEST SUN, AXI-DEV-2026-003 (devis INVEST SUN) ;
--   • la stagiaire Simone Blanc — elle est inscrite à la session conservée.
--     Seule son inscription à la session d'essai disparaît ;
--   • les FORMATIONS et les FORMATEURS : catalogue et intervenants réels. Les
--     sessions d'essai pointaient sur de vraies formations ; les supprimer
--     serait une faute ;
--   • tout autre client du CRM : la suppression est pilotée par une liste
--     NOMMÉE, jamais par « client sans session » — un prospect n'a pas de
--     session, et l'heuristique aurait vidé la prospection.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Garde-fou : la session à conserver DOIT exister ─────────────────────────
-- Sans elle, « toutes les sessions sauf celle-ci » vaut « toutes les sessions ».
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM training_sessions WHERE numero = 'AXI-SESS-2026-003') THEN
    RAISE EXCEPTION
      'ARRET — AXI-SESS-2026-003 introuvable. Sans elle ce script viderait TOUTES les sessions. Rien n''a ete touche.';
  END IF;
END $$;

-- ── Périmètre ───────────────────────────────────────────────────────────────
CREATE TEMP TABLE _sessions AS
  SELECT id FROM training_sessions WHERE numero <> 'AXI-SESS-2026-003';

CREATE TEMP TABLE _clients AS
  SELECT id FROM clients WHERE numero IN ('AXI-CLI-001', 'AXI-CLI-002');

CREATE TEMP TABLE _devis AS
  SELECT id FROM devis
   WHERE numero IN ('AXI-DEV-2026-001', 'AXI-DEV-2026-002', 'AXI-DEV-2026-004');

CREATE TEMP TABLE _trainees AS
  SELECT id FROM trainees WHERE email = 'williamsjullin+audit-stagiaire1@gmail.com';

CREATE TEMP TABLE _enrollments AS
  SELECT id FROM enrollments WHERE session_id IN (SELECT id FROM _sessions);

CREATE TEMP TABLE _documents AS
  SELECT id FROM documents_generes
   WHERE session_id IN (SELECT id FROM _sessions)
      OR client_id  IN (SELECT id FROM _clients)
      OR trainee_id IN (SELECT id FROM _trainees);

-- ── Ce qui va être détruit ──────────────────────────────────────────────────
\echo ''
\echo '=== PERIMETRE ==='
SELECT numero, titre_session, statut FROM training_sessions
 WHERE id IN (SELECT id FROM _sessions) ORDER BY numero;
SELECT numero, raison_sociale FROM clients
 WHERE id IN (SELECT id FROM _clients) ORDER BY numero;
SELECT numero FROM devis WHERE id IN (SELECT id FROM _devis) ORDER BY numero;
SELECT prenom, nom, email FROM trainees WHERE id IN (SELECT id FROM _trainees);
\echo ''
\echo '=== SESSION CONSERVEE ==='
SELECT numero, titre_session, statut FROM training_sessions
 WHERE numero = 'AXI-SESS-2026-003';

-- ── Suppressions, enfants -> parents ────────────────────────────────────────
-- Les relations Restrict (signatures, jetons, contresignatures, factures)
-- DOIVENT partir avant leur parent, sinon Postgres refuse.
\echo ''
\echo '=== SUPPRESSIONS ==='

DELETE FROM document_signature_tokens WHERE document_genere_id IN (SELECT id FROM _documents);
DELETE FROM document_signatures       WHERE document_genere_id IN (SELECT id FROM _documents);
DELETE FROM emargement_signatures     WHERE enrollment_id      IN (SELECT id FROM _enrollments);
DELETE FROM emargement_tokens         WHERE enrollment_id      IN (SELECT id FROM _enrollments);
DELETE FROM emargement_contresignatures WHERE session_id       IN (SELECT id FROM _sessions);

DELETE FROM factures_formation
 WHERE session_id IN (SELECT id FROM _sessions)
    OR client_id  IN (SELECT id FROM _clients);

DELETE FROM appreciations
 WHERE enrollment_id IN (SELECT id FROM _enrollments)
    OR client_id     IN (SELECT id FROM _clients)
    OR trainee_id    IN (SELECT id FROM _trainees);

DELETE FROM reclamations       WHERE enrollment_id      IN (SELECT id FROM _enrollments);
DELETE FROM documents_generes  WHERE id                 IN (SELECT id FROM _documents);
DELETE FROM incidents          WHERE session_id         IN (SELECT id FROM _sessions);
DELETE FROM dossiers_financement WHERE training_session_id IN (SELECT id FROM _sessions);
DELETE FROM trainer_fee_lines  WHERE session_id         IN (SELECT id FROM _sessions);

-- Cascade : presence_creneaux, evaluations_acquis, questionnaires
DELETE FROM enrollments        WHERE id                 IN (SELECT id FROM _enrollments);

-- Cascade : session_jours, session_formateurs, formation_transitions,
--           releves_connexion_imports
DELETE FROM training_sessions  WHERE id                 IN (SELECT id FROM _sessions);

DELETE FROM devis              WHERE id                 IN (SELECT id FROM _devis);
DELETE FROM trainees           WHERE id                 IN (SELECT id FROM _trainees);  -- cascade portail_acces
DELETE FROM clients            WHERE id                 IN (SELECT id FROM _clients);

-- Les alertes désignent leur cible par cible_id : sans ce nettoyage elles
-- survivraient à leur objet et resteraient affichées en pointant une session
-- qui n'existe plus.
DELETE FROM alertes_systeme
 WHERE cible_id IN (
   SELECT id FROM _sessions UNION ALL
   SELECT id FROM _clients  UNION ALL
   SELECT id FROM _devis    UNION ALL
   SELECT id FROM _trainees
 );

-- ── Contrôle final ──────────────────────────────────────────────────────────
\echo ''
\echo '=== SESSIONS RESTANTES (doit afficher UNIQUEMENT AXI-SESS-2026-003) ==='
SELECT numero, titre_session, statut FROM training_sessions ORDER BY numero;
\echo ''
\echo '=== CLIENTS RESTANTS ==='
SELECT numero, raison_sociale FROM clients ORDER BY numero;
\echo ''
\echo '=== STAGIAIRES RESTANTS ==='
SELECT prenom, nom, email FROM trainees ORDER BY nom;

-- ============================================================================
-- SIMULATION par défaut. Remplacer par COMMIT pour exécuter réellement.
-- ============================================================================
ROLLBACK;
