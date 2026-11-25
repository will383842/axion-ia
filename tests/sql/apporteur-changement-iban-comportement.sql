-- COMPORTEMENT du changement d'IBAN des apporteurs (migration 20261126120000_apporteur_changement_iban, lot 1).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/apporteur-changement-iban-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
-- Les IBAN ci-dessous sont des CHIFFRES FICTIFS de forme `enc:v2:` : aucun IBAN, ni reel ni de documentation.
\set QUIET on

-- 1. Une seule demande OUVERTE par apporteur ; une demande close n'empeche pas la suivante.
BEGIN;
DO $$
DECLARE
  ap uuid := gen_random_uuid();
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
  d1 uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (d1, ap, chiffre, h, '1234', 'espace');
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (gen_random_uuid(), ap, chiffre, h, '1234', 'espace');
    RAISE EXCEPTION 'AXT99 deuxieme demande ouverte acceptee';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  -- expiree (ecriture conditionnelle) : la nouvelle passe.
  UPDATE apporteur_changements_iban SET statut = 'expiree', expiree_at = now() WHERE id = d1;
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (gen_random_uuid(), ap, chiffre, h, '1234', 'espace');
  -- un autre apporteur n'est pas gene.
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace');
END $$;
ROLLBACK;

-- 2. L'IBAN n'est JAMAIS en clair : ni en clair, ni sous un simple prefixe, ni dans l'historique.
BEGIN;
DO $$
DECLARE
  h text := repeat('d', 64);
  mauvais text;
BEGIN
  FOREACH mauvais IN ARRAY ARRAY['FR7630006000011234567890189', 'enc:v2:FR7630006000011234567890189', 'enc:v1:aa:bb:cc', '']
  LOOP
    BEGIN
      INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
      VALUES (gen_random_uuid(), gen_random_uuid(), mauvais, h, '1234', 'espace');
      RAISE EXCEPTION 'AXT99 IBAN non chiffre accepte dans la demande : %', mauvais;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
      VALUES (gen_random_uuid(), gen_random_uuid(), mauvais, h, '1234', 'dossier_initial');
      RAISE EXCEPTION 'AXT99 IBAN non chiffre accepte dans l historique : %', mauvais;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
END $$;
ROLLBACK;

-- 3. Statut, origine, empreinte et quatre caracteres sont bornes ; la coherence d'etat est exigee.
BEGIN;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
BEGIN
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'inconnu');
    RAISE EXCEPTION 'AXT99 statut inconnu accepte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'autre');
    RAISE EXCEPTION 'AXT99 origine inconnue acceptee';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, 'abc', '1234', 'espace');
    RAISE EXCEPTION 'AXT99 empreinte courte acceptee';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, 'FR76', 'espace');
    -- 'FR76' a la forme de quatre caracteres : accepte (c est la fin d'un IBAN, jamais le debut utile).
  END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '12 4', 'espace');
    RAISE EXCEPTION 'AXT99 quatre caracteres invalides acceptes';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- confirmee sans date de confirmation ; validee sans auteur ; refusee sans motif : refuses.
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'confirmee');
    RAISE EXCEPTION 'AXT99 confirmee sans date acceptee';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut, confirmee_at, traitee_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'validee', now(), now());
    RAISE EXCEPTION 'AXT99 validee sans auteur acceptee';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut, confirmee_at, traitee_at, traitee_par, motif_refus)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'refusee', now(), now(), gen_random_uuid(), '   ');
    RAISE EXCEPTION 'AXT99 refusee sans motif acceptee';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- cas complets acceptes.
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut, confirmee_at, traitee_at, traitee_par)
  VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'validee', now(), now(), gen_random_uuid());
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut, confirmee_at, traitee_at, traitee_par, motif_refus)
  VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'console', 'refusee', now(), now(), gen_random_uuid(), 'Titulaire different');
END $$;
ROLLBACK;

-- 4. Jamais de DELETE ni de TRUNCATE ; le coeur d'une demande ne change pas ; une demande decidee est figee ;
--    on ne saute pas a « validee » sans passer par « confirmee ».
BEGIN;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  autre text := 'enc:v2:' || repeat('1', 24) || ':' || repeat('2', 40) || ':' || repeat('3', 32);
  h text := repeat('d', 64);
  d uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (d, gen_random_uuid(), chiffre, h, '1234', 'espace');
  BEGIN
    DELETE FROM apporteur_changements_iban WHERE id = d;
    RAISE EXCEPTION 'AXT99 DELETE accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    TRUNCATE apporteur_changements_iban;
    RAISE EXCEPTION 'AXT99 TRUNCATE accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  -- le coeur ne change pas
  BEGIN
    UPDATE apporteur_changements_iban SET iban = autre WHERE id = d;
    RAISE EXCEPTION 'AXT99 IBAN demande modifie';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_changements_iban SET apporteur_id = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 fiche de la demande changee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  -- a_confirmer -> validee : interdit
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'validee', confirmee_at = now(), traitee_at = now(), traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 saut a validee accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  -- a_confirmer -> confirmee -> validee : permis
  UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() WHERE id = d;
  UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now(), traitee_par = gen_random_uuid() WHERE id = d;
  -- figee ensuite
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'opposee', opposee_at = now() WHERE id = d;
    RAISE EXCEPTION 'AXT99 opposition apres validation acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_changements_iban SET traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 auteur de la decision reecrit';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

-- 5. Le RIB joint : plafond de 10 Mo, octets chiffres (AXB1), purge coherente.
BEGIN;
DO $$
DECLARE
  h text := repeat('e', 64);
  axb1 bytea := '\x41584231' || decode(repeat('00', 40), 'hex');
BEGIN
  INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
  VALUES (gen_random_uuid(), axb1, h, 'application/pdf', 44);
  INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
  VALUES (gen_random_uuid(), axb1, h, 'application/pdf', 10485760);
  BEGIN
    INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
    VALUES (gen_random_uuid(), axb1, h, 'application/pdf', 10485761);
    RAISE EXCEPTION 'AXT99 RIB au dela de 10 Mo accepte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
    VALUES (gen_random_uuid(), axb1, h, 'application/pdf', 0);
    RAISE EXCEPTION 'AXT99 RIB vide accepte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- des octets en clair (un PDF) : refuses
  BEGIN
    INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
    VALUES (gen_random_uuid(), '\x255044462d312e34'::bytea, h, 'application/pdf', 8);
    RAISE EXCEPTION 'AXT99 RIB en clair accepte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- purge : octets nuls ET purge_at pose, ensemble ; jamais l'un sans l'autre
  BEGIN
    INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
    VALUES (gen_random_uuid(), NULL, h, 'application/pdf', 44);
    RAISE EXCEPTION 'AXT99 RIB sans octets et sans purge accepte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille, purge_at)
  VALUES (gen_random_uuid(), NULL, h, 'application/pdf', 44, now());
END $$;
ROLLBACK;

-- 6. L'historique : ajout seul, seule la fin de validite passe de NULL a une date.
BEGIN;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
  id1 uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (id1, gen_random_uuid(), chiffre, h, '1234', 'dossier_initial');
  -- un compte « changement » vient d'une demande
  BEGIN
    INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'changement');
    RAISE EXCEPTION 'AXT99 changement sans demande accepte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    DELETE FROM apporteur_iban_historique WHERE id = id1;
    RAISE EXCEPTION 'AXT99 DELETE historique accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    TRUNCATE apporteur_iban_historique;
    RAISE EXCEPTION 'AXT99 TRUNCATE historique accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_iban_historique SET iban_fin4 = '9999' WHERE id = id1;
    RAISE EXCEPTION 'AXT99 ligne d historique reecrite';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  UPDATE apporteur_iban_historique SET en_vigueur_jusqua = now() WHERE id = id1;
  BEGIN
    UPDATE apporteur_iban_historique SET en_vigueur_jusqua = now() + interval '1 day' WHERE id = id1;
    RAISE EXCEPTION 'AXT99 fin de validite posee puis changee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

-- 7. Le compte d'un virement : ajout seul (ni UPDATE, ni DELETE, ni TRUNCATE) ; empreinte bornee.
BEGIN;
DO $$
DECLARE
  h text := repeat('d', 64);
BEGIN
  INSERT INTO apporteur_virements_compte (autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, declare_par)
  VALUES ('AXI-APP-TEST-1', gen_random_uuid(), h, '1234', 'admin-test');
  BEGIN
    INSERT INTO apporteur_virements_compte (autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, declare_par)
    VALUES ('AXI-APP-TEST-1', gen_random_uuid(), h, '1234', 'admin-test');
    RAISE EXCEPTION 'AXT99 deux comptes pour une autofacture';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_virements_compte (autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, declare_par)
    VALUES ('AXI-APP-TEST-2', gen_random_uuid(), 'FR7630006000011234567890189', '1234', 'admin-test');
    RAISE EXCEPTION 'AXT99 IBAN en clair accepte comme empreinte';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE apporteur_virements_compte SET iban_fin4 = '9999';
    RAISE EXCEPTION 'AXT99 UPDATE accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    DELETE FROM apporteur_virements_compte;
    RAISE EXCEPTION 'AXT99 DELETE accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    TRUNCATE apporteur_virements_compte;
    RAISE EXCEPTION 'AXT99 TRUNCATE accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
