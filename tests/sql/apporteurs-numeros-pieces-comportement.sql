-- COMPORTEMENT de l'unicité des numéros de pièces d'autofacture (#2464 point 13) :
-- migrations 20261128090000_apporteurs_numeros_pieces_uniques et 20261128130000_apporteurs_numeros_pieces_reservation.
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/apporteurs-numeros-pieces-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
-- Aucune donnee reelle : identifiants aleatoires, numeros fictifs.
\set QUIET on

-- Aide : une ligne de commission minimale (colonnes obligatoires seulement).
CREATE OR REPLACE FUNCTION pg_temp.ligne(ap uuid, af text, av text DEFAULT NULL) RETURNS void AS $$
  INSERT INTO commissions_apporteur (id, apporteur_id, facture_id, activite, facture_ht_cents, autofacture_numero, avoir_numero, maj_at)
  VALUES (gen_random_uuid(), ap, gen_random_uuid(), 'formation', 1000, af, av, now());
$$ LANGUAGE sql;

-- 1. Un meme apporteur peut avoir PLUSIEURS lignes sous le meme numero (une autofacture, plusieurs lignes).
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.ligne(a, 'AXT-AF-1');
  PERFORM pg_temp.ligne(a, 'AXT-AF-1');
  PERFORM pg_temp.ligne(a, 'AXT-AF-1');
  IF (SELECT count(*) FROM commissions_apporteur WHERE autofacture_numero = 'AXT-AF-1') <> 3 THEN
    RAISE EXCEPTION 'AXT99 plusieurs lignes du meme apporteur refusees';
  END IF;
  IF (SELECT apporteur_id FROM apporteur_numeros_reserves WHERE numero = 'AXT-AF-1') <> a THEN
    RAISE EXCEPTION 'AXT99 numero non reserve par le declencheur';
  END IF;
END $$;
ROLLBACK;

-- 2. Un autre apporteur, meme numero : refuse (23505), en autofacture comme en avoir, et croise.
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
BEGIN
  PERFORM pg_temp.ligne(a, 'AXT-AF-2', 'AXT-AV-2');
  BEGIN
    PERFORM pg_temp.ligne(b, 'AXT-AF-2');
    RAISE EXCEPTION 'AXT99 meme numero pour un autre apporteur accepte (autofacture)';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM pg_temp.ligne(b, 'AXT-AF-3', 'AXT-AV-2');
    RAISE EXCEPTION 'AXT99 meme numero pour un autre apporteur accepte (avoir)';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM pg_temp.ligne(b, 'AXT-AV-2');
    RAISE EXCEPTION 'AXT99 numero d avoir reutilise en autofacture par un autre apporteur';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
ROLLBACK;

-- 3. Concurrence : un numero deja RESERVE (par une transaction concurrente validee) refuse un autre apporteur
--    meme si aucune ligne de commission ne le porte encore (le EXISTS d avant ne l aurait pas vu).
BEGIN;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_numeros_reserves (numero, apporteur_id) VALUES ('AXT-AF-4', a);
  BEGIN
    PERFORM pg_temp.ligne(b, 'AXT-AF-4');
    RAISE EXCEPTION 'AXT99 numero reserve par un autre apporteur accepte';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  PERFORM pg_temp.ligne(a, 'AXT-AF-4'); -- le proprietaire de la reservation passe
END $$;
ROLLBACK;

-- 4. Doublon HISTORIQUE (A et B sous le meme numero, poses sans declencheur) : accepte au deploiement, rejeu possible,
--    et un UPDATE d une AUTRE colonne dessus reste accepte (le declencheur ne regarde que les numeros et l apporteur).
BEGIN;
ALTER TABLE commissions_apporteur DISABLE TRIGGER commissions_apporteur_numero_un_apporteur;
DO $$
DECLARE a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); id_b uuid;
BEGIN
  PERFORM pg_temp.ligne(a, 'AXT-AF-5');
  PERFORM pg_temp.ligne(b, 'AXT-AF-5');
  SELECT id INTO id_b FROM commissions_apporteur WHERE apporteur_id = b AND autofacture_numero = 'AXT-AF-5';
  ALTER TABLE commissions_apporteur ENABLE TRIGGER commissions_apporteur_numero_un_apporteur;
  UPDATE commissions_apporteur SET facture_ht_cents = 2000, maj_at = now() WHERE id = id_b;
  IF (SELECT facture_ht_cents FROM commissions_apporteur WHERE id = id_b) <> 2000 THEN
    RAISE EXCEPTION 'AXT99 UPDATE d une autre colonne sur un doublon historique refuse';
  END IF;
END $$;
ROLLBACK;

-- 5. Rejeu : la migration de reservation se rejoue sans erreur (CREATE IF NOT EXISTS, OR REPLACE, ON CONFLICT).
BEGIN;
\i prisma/migrations/20261128130000_apporteurs_numeros_pieces_reservation/migration.sql
ROLLBACK;

-- 6. Marqueur « geste commercial » : faux par defaut sur la piece d avoir.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'factures_formation' AND column_name = 'geste_commercial'
       AND is_nullable = 'NO' AND column_default = 'false'
  ) THEN
    RAISE EXCEPTION 'AXT99 colonne geste_commercial absente, nullable ou sans defaut false';
  END IF;
END $$;
ROLLBACK;
