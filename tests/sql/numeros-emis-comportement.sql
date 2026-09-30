-- ═════════════════════════════════════════════════════════════════════════════
-- Gate D — COMPORTEMENT du registre append-only `numeros_emis`
-- (migration 20260930120000_numeros_emis_registre).
--
-- Lancé par `.github/workflows/ci.yml` (job gate-d-migration) :
--   psql -v ON_ERROR_STOP=1 -f tests/sql/numeros-emis-comportement.sql
--
-- Chaque cas vit dans SA transaction, ANNULÉE (ROLLBACK) : aucune ligne ne
-- reste. `AXT99` n'est attrapé par AUCUN cas : une attente déçue remonte,
-- `ON_ERROR_STOP` arrête psql, Gate D rougit.
--
-- Mutations qui font rougir : retirer n'importe lequel des 11 déclencheurs
-- (ou le désactiver) → le cas 0 le nomme → AXT99 ; retirer
-- `clients_numero_emis` rougit aussi le cas 1.
-- ═════════════════════════════════════════════════════════════════════════════

\set QUIET on

-- 0. Les 11 déclencheurs EXISTENT EN BASE, chacun sur SA table.
--    La spec `tout-allocateur-alimente-le-registre-des-numeros.spec.ts` lit
--    CETTE liste et exige qu'elle soit identique à celle qu'elle dérive des
--    appels à `nextNumero` : la liste ne peut pas dériver en silence. Un
--    `DROP TRIGGER` d'une migration ultérieure rougit ici, pas dans la spec.
DO $$
DECLARE
  manquants text;
BEGIN
  SELECT string_agg(attendu.nom || ' sur ' || attendu.tab, ', ')
    INTO manquants
  FROM (VALUES
    -- déclencheurs-attendus:début
    ('audit_missions', 'audit_missions_numero_emis'),
    ('clients', 'clients_numero_emis'),
    ('devis', 'devis_numero_emis'),
    ('documents_generes', 'documents_generes_numero_emis'),
    ('factures_formation', 'factures_formation_numero_emis'),
    ('formations', 'formations_numero_emis'),
    ('reclamations', 'reclamations_numero_emis'),
    ('trainer_statements', 'trainer_statements_numero_emis'),
    ('training_sessions', 'training_sessions_numero_emis'),
    ('numeros_emis', 'numeros_emis_ajout_seul'),
    ('numeros_emis', 'numeros_emis_pas_de_truncate')
    -- déclencheurs-attendus:fin
  ) AS attendu(tab, nom)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = attendu.nom AND c.relname = attendu.tab AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  );
  IF manquants IS NOT NULL THEN
    RAISE EXCEPTION 'numeros_emis : déclencheur(s) absent(s) ou désactivé(s) en base : %', manquants
      USING ERRCODE = 'AXT99';
  END IF;
END $$;

-- 1. Un numéro écrit dans une table porteuse entre au registre, et y RESTE
--    quand la ligne métier est supprimée (le défaut du 2026-09-15).
BEGIN;
INSERT INTO clients (id, numero, raison_sociale, updated_at)
VALUES ('00000000-0000-4000-8000-0000000009e1', 'AXI-CLI-NUMEROS-EMIS-1', 'Client fictif registre', now());
DELETE FROM clients WHERE id = '00000000-0000-4000-8000-0000000009e1';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM numeros_emis
    WHERE numero = 'AXI-CLI-NUMEROS-EMIS-1' AND table_source = 'clients'
  ) THEN
    RAISE EXCEPTION 'le numéro supprimé côté métier devait rester au registre' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

-- 2. Un changement de numéro (brouillon → numéro définitif) entre aussi.
BEGIN;
INSERT INTO clients (id, numero, raison_sociale, updated_at)
VALUES ('00000000-0000-4000-8000-0000000009e2', 'AXI-CLI-NUMEROS-EMIS-2', 'Client fictif registre', now());
UPDATE clients SET numero = 'AXI-CLI-NUMEROS-EMIS-3' WHERE id = '00000000-0000-4000-8000-0000000009e2';
DO $$ BEGIN
  IF (SELECT count(*) FROM numeros_emis
      WHERE numero IN ('AXI-CLI-NUMEROS-EMIS-2', 'AXI-CLI-NUMEROS-EMIS-3')) <> 2 THEN
    RAISE EXCEPTION 'les deux numéros successifs devaient être au registre' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

-- 3. Une insertion ANNULÉE n'émet rien (le déclencheur vit dans la transaction).
BEGIN;
SAVEPOINT avant;
INSERT INTO clients (id, numero, raison_sociale, updated_at)
VALUES ('00000000-0000-4000-8000-0000000009e4', 'AXI-CLI-NUMEROS-EMIS-4', 'Client fictif registre', now());
ROLLBACK TO SAVEPOINT avant;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM numeros_emis WHERE numero = 'AXI-CLI-NUMEROS-EMIS-4') THEN
    RAISE EXCEPTION 'une insertion annulée ne doit rien laisser au registre' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

-- 4. Ajout seul : DELETE refusé.
BEGIN;
INSERT INTO numeros_emis (numero, table_source) VALUES ('AXI-TEST-NUMEROS-EMIS-5', 'test');
DO $$ BEGIN
  DELETE FROM numeros_emis WHERE numero = 'AXI-TEST-NUMEROS-EMIS-5';
  RAISE EXCEPTION 'devait échouer : DELETE sur numeros_emis' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXN01' THEN NULL;
END $$;
ROLLBACK;

-- 5. Ajout seul : UPDATE refusé.
BEGIN;
INSERT INTO numeros_emis (numero, table_source) VALUES ('AXI-TEST-NUMEROS-EMIS-6', 'test');
DO $$ BEGIN
  UPDATE numeros_emis SET table_source = 'autre' WHERE numero = 'AXI-TEST-NUMEROS-EMIS-6';
  RAISE EXCEPTION 'devait échouer : UPDATE sur numeros_emis' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXN01' THEN NULL;
END $$;
ROLLBACK;

-- 6. Ajout seul : TRUNCATE refusé.
BEGIN;
DO $$ BEGIN
  TRUNCATE numeros_emis;
  RAISE EXCEPTION 'devait échouer : TRUNCATE sur numeros_emis' USING ERRCODE = 'AXT99';
EXCEPTION WHEN SQLSTATE 'AXN01' THEN NULL;
END $$;
ROLLBACK;

-- 7. Un numéro déjà au registre, réécrit ailleurs, ne fait pas échouer
--    l'écriture métier (ON CONFLICT DO NOTHING) et garde sa première source.
BEGIN;
INSERT INTO numeros_emis (numero, table_source) VALUES ('AXI-CLI-NUMEROS-EMIS-8', 'documents_generes');
INSERT INTO clients (id, numero, raison_sociale, updated_at)
VALUES ('00000000-0000-4000-8000-0000000009e8', 'AXI-CLI-NUMEROS-EMIS-8', 'Client fictif registre', now());
DO $$ BEGIN
  IF (SELECT table_source FROM numeros_emis WHERE numero = 'AXI-CLI-NUMEROS-EMIS-8') <> 'documents_generes' THEN
    RAISE EXCEPTION 'la première source devait être conservée' USING ERRCODE = 'AXT99';
  END IF;
END $$;
ROLLBACK;

\echo 'numeros_emis : 11 déclencheurs présents, 7 cas de comportement verts'
