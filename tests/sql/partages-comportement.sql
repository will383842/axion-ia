-- ═════════════════════════════════════════════════════════════════════════════
-- Gate D — COMPORTEMENT du SQL brut des LIENS PRIVÉS de fichiers
-- (Candidatures unifiées L5, ADR 0065 D5/D6 ; critique 05 [B1]).
--
-- Lancé par `.github/workflows/ci.yml` (job gate-d-migration) :
--   psql -v ON_ERROR_STOP=1 -f tests/sql/partages-comportement.sql
--
-- Chaque cas vit dans SA transaction, ANNULÉE à la fin (ROLLBACK) : aucune
-- ligne ne reste. `AXT99` n'est attrapé par AUCUN cas : si une attente n'est
-- pas tenue, l'exception remonte, `ON_ERROR_STOP` arrête psql, Gate D rougit.
--
-- Cas 1 [B1] — L'EFFACEMENT MANUEL D'UN DOSSIER APRÈS UN TÉLÉCHARGEMENT
-- JOURNALISÉ RÉUSSIT : le lien part en cascade (pas de trigger anti-suppression
-- sur `liens_partage`), le journal des accès RESTE (sans clé étrangère, ajout
-- seul) et le fichier RESTE (on ne purge rien).
-- Mutation qui fait rougir : poser une clé étrangère de `liens_partage_acces`
-- vers `liens_partage`, ou un trigger anti-DELETE sur `liens_partage` → le
-- DELETE du dossier échoue → psql s'arrête → rouge.
--
-- Cas 2 — un lien retiré le reste (AXP02) ; seuls `expire_le`, `revoque_le`,
-- `motif_retrait` changent.
-- ═════════════════════════════════════════════════════════════════════════════

\set QUIET on

CREATE FUNCTION pg_temp.partages_fixture() RETURNS void LANGUAGE sql AS $$
  INSERT INTO job_applications (id, offer_title_snap, first_name, last_name, email, phone, consent_version, updated_at)
  VALUES ('00000000-0000-4000-8000-0000000005a1', 'Monteur fictif', 'x', 'y', 'z', 'p', 'v-test', now());
  INSERT INTO fichiers_partages (id, titre, nature, categorie, url_externe, etat_depot, depose_par_nom)
  VALUES ('00000000-0000-4000-8000-0000000005b1', 'Rushs fictifs', 'lien_externe', 'rushs',
          'https://drive.example/rushs', 'disponible', 'Équipe');
  INSERT INTO liens_partage (id, application_id, reponse_id, expire_le, cree_par_nom)
  VALUES ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000005a1',
          'rep-fictive', now() + interval '7 days', 'Équipe');
  INSERT INTO liens_partage_fichiers (lien_id, fichier_id)
  VALUES ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000005b1');
  INSERT INTO liens_partage_acces (id, lien_id, fichier_id, type, origine) VALUES
    ('00000000-0000-4000-8000-0000000005d1', '00000000-0000-4000-8000-0000000005c1', NULL, 'page_ouverte', 'navigateur'),
    ('00000000-0000-4000-8000-0000000005d2', '00000000-0000-4000-8000-0000000005c1',
     '00000000-0000-4000-8000-0000000005b1', 'telechargement', 'navigateur');
$$;

-- ── Cas 1 : effacement manuel du dossier après un téléchargement journalisé ──
BEGIN;
SELECT pg_temp.partages_fixture();
DELETE FROM job_applications WHERE id = '00000000-0000-4000-8000-0000000005a1';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM liens_partage WHERE id = '00000000-0000-4000-8000-0000000005c1') THEN
    RAISE EXCEPTION 'devait partir : le lien suit le dossier en cascade' USING ERRCODE = 'AXT99';
  END IF;
  IF EXISTS (SELECT 1 FROM liens_partage_fichiers WHERE lien_id = '00000000-0000-4000-8000-0000000005c1') THEN
    RAISE EXCEPTION 'devait partir : les fichiers du lien suivent le lien' USING ERRCODE = 'AXT99';
  END IF;
  IF (SELECT count(*) FROM liens_partage_acces WHERE lien_id = '00000000-0000-4000-8000-0000000005c1') <> 2 THEN
    RAISE EXCEPTION 'devait rester : le journal des accès (ajout seul, sans clé étrangère)' USING ERRCODE = 'AXT99';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM fichiers_partages WHERE id = '00000000-0000-4000-8000-0000000005b1') THEN
    RAISE EXCEPTION 'devait rester : le fichier (rien ne se purge)' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

-- ── Cas 2 : retirer, prolonger ; un lien retiré le reste ──
BEGIN;
SELECT pg_temp.partages_fixture();
UPDATE liens_partage SET expire_le = now() + interval '30 days'
  WHERE id = '00000000-0000-4000-8000-0000000005c1';
UPDATE liens_partage SET revoque_le = now(), motif_retrait = 'retiré depuis la fiche'
  WHERE id = '00000000-0000-4000-8000-0000000005c1';
DO $$ BEGIN
  UPDATE liens_partage SET revoque_le = NULL WHERE id = '00000000-0000-4000-8000-0000000005c1';
  RAISE EXCEPTION 'devait échouer : un lien retiré le reste' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXP02' THEN NULL;
END $$;
DO $$ BEGIN
  UPDATE liens_partage SET reponse_id = 'autre' WHERE id = '00000000-0000-4000-8000-0000000005c1';
  RAISE EXCEPTION 'devait échouer : un lien ne se réécrit pas' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXP02' THEN NULL;
END $$;
ROLLBACK;
