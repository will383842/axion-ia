-- COMPORTEMENT de la signature renforcee du devis (migration 20261107120000_devis_signature_renforcee).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/signature-renforcee-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
-- Les lignes de test portent des identifiants fixes ; rien ne subsiste (ROLLBACK).
\set QUIET on

-- 1. Colonnes de la declaration : tout ou rien, coherentes avec l instant de signature.
BEGIN;
DO $$
DECLARE
  h text := repeat('a', 64);
  piece uuid := gen_random_uuid();
  sig uuid := gen_random_uuid();
BEGIN
  -- Les colonnes et la table existent.
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'document_signatures'
     AND column_name IN ('declaration_nom', 'declaration_fonction', 'pouvoir_declare_at', 'code_verifie_at')
   HAVING count(*) = 4;
  IF NOT FOUND THEN RAISE EXCEPTION 'AXT99 colonnes de declaration absentes'; END IF;
  PERFORM 1 FROM information_schema.columns
   WHERE table_name = 'document_signature_codes' AND column_name IN ('jeton_id', 'bloque_jusqu_a')
   HAVING count(*) = 2;
  IF NOT FOUND THEN RAISE EXCEPTION 'AXT99 colonnes du code absentes'; END IF;

  -- La contrainte refuse une declaration partielle et accepte les cas coherents. On verifie sur la
  -- definition elle-meme (une ligne de document_signatures exige toute la chaine des pieces).
  PERFORM 1 FROM pg_constraint
   WHERE conname = 'document_signatures_declaration_chk'
     AND pg_get_constraintdef(oid) LIKE '%pouvoir_declare_at%'
     AND pg_get_constraintdef(oid) LIKE '%code_verifie_at%';
  IF NOT FOUND THEN RAISE EXCEPTION 'AXT99 contrainte declaration absente'; END IF;
END $$;
ROLLBACK;

-- 2. Horodatages : statut/jeton coherents, ajout seul, jeton obtenu definitif.
-- La cle etrangere vers la signature est levee DANS la transaction annulee (le DDL de Postgres est
-- transactionnel) : on teste la table et ses declencheurs, pas la chaine des pieces parentes.
BEGIN;
ALTER TABLE document_signature_horodatages DROP CONSTRAINT document_signature_horodatages_signature_id_fkey;
DO $$
DECLARE
  h text := repeat('b', 64);
  sig uuid;
  ho uuid := gen_random_uuid();
BEGIN
  sig := gen_random_uuid();

  -- en_attente sans jeton : accepte.
  INSERT INTO document_signature_horodatages (id, signature_id, empreinte_sha256, prochain_essai_at)
  VALUES (ho, sig, h, now());

  -- en_attente avec jeton : refuse.
  BEGIN
    INSERT INTO document_signature_horodatages (id, signature_id, empreinte_sha256, prochain_essai_at, jeton)
    VALUES (gen_random_uuid(), gen_random_uuid(), h, now(), '\x01');
    RAISE EXCEPTION 'AXT99 en_attente avec jeton accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- empreinte mal formee : refusee.
  BEGIN
    INSERT INTO document_signature_horodatages (id, signature_id, empreinte_sha256, prochain_essai_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), 'ZZ', now());
    RAISE EXCEPTION 'AXT99 empreinte mal formee acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- obtenu incomplet : refuse.
  BEGIN
    UPDATE document_signature_horodatages SET statut = 'obtenu' WHERE id = ho;
    RAISE EXCEPTION 'AXT99 obtenu sans jeton accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- le suivi (essais, echeance, erreur) est modifiable.
  UPDATE document_signature_horodatages
     SET essais = 1, dernier_essai_at = now(), prochain_essai_at = now() + interval '5 minutes', derniere_erreur = 'autorite injoignable'
   WHERE id = ho;

  -- l empreinte, la signature et la creation sont immuables.
  BEGIN
    UPDATE document_signature_horodatages SET empreinte_sha256 = repeat('c', 64) WHERE id = ho;
    RAISE EXCEPTION 'AXT99 empreinte modifiee';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE document_signature_horodatages SET signature_id = gen_random_uuid() WHERE id = ho;
    RAISE EXCEPTION 'AXT99 signature modifiee';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  -- obtention : jeton, empreinte du jeton, instant et autorite ensemble.
  UPDATE document_signature_horodatages
     SET statut = 'obtenu', jeton = '\x3003020101', jeton_sha256 = repeat('d', 64), horodate_at = now(), autorite = 'https://tsa.exemple.test'
   WHERE id = ho;

  -- un jeton obtenu est definitif.
  BEGIN
    UPDATE document_signature_horodatages SET jeton = '\x00' WHERE id = ho;
    RAISE EXCEPTION 'AXT99 jeton obtenu modifie';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  -- ni DELETE ni TRUNCATE.
  BEGIN
    DELETE FROM document_signature_horodatages WHERE id = ho;
    RAISE EXCEPTION 'AXT99 DELETE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    TRUNCATE document_signature_horodatages;
    RAISE EXCEPTION 'AXT99 TRUNCATE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  -- une signature n a qu un horodatage.
  BEGIN
    INSERT INTO document_signature_horodatages (id, signature_id, empreinte_sha256, prochain_essai_at)
    VALUES (gen_random_uuid(), sig, h, now());
    RAISE EXCEPTION 'AXT99 doublon accepte';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
ROLLBACK;
