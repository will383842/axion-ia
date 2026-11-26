-- COMPORTEMENT du changement d'IBAN des apporteurs (migration 20261126150000_apporteur_changement_iban, lot 1).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/apporteur-changement-iban-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
-- Les valeurs chiffrees sont FICTIVES (forme `enc:v2:`). Les rares IBAN en clair sont des IBAN de DOCUMENTATION,
-- jamais reels, et servent a prouver qu'ils sont REFUSES.
\set QUIET on

-- 1. Une seule demande OUVERTE par apporteur ; une demande close n'empeche pas la suivante.
BEGIN;
-- Cas qui ont besoin de dates passees : seul le declencheur d'horloge est desactive (transaction annulee).
ALTER TABLE apporteur_changements_iban DISABLE TRIGGER apporteur_changements_iban_horloge;
DO $$
DECLARE
  ap uuid := gen_random_uuid();
  ap2 uuid := gen_random_uuid();
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
  -- Demande a 23 h : l'ecriture conditionnelle de la creation (`demandee_at < maintenant - 24 h`) n'expire rien,
  -- la nouvelle demande est refusee.
    UPDATE apporteur_changements_iban SET statut = 'expiree', expiree_at = now()
   WHERE apporteur_id = ap AND statut = 'a_confirmer' AND demandee_at < now() - interval '24 hours';
  IF (SELECT statut FROM apporteur_changements_iban WHERE id = d1) <> 'a_confirmer' THEN
    RAISE EXCEPTION 'AXT99 demande de moins de 24 h expiree';
  END IF;
  -- Demande a 25 h (la ligne de depart, ANTIDATEE : `demandee_at` est fige, on en insere une autre) : expiree
  -- PUIS insertion, dans la meme transaction.
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, demandee_at)
  VALUES (gen_random_uuid(), ap2, chiffre, h, '1234', 'espace', now() - interval '25 hours');
  UPDATE apporteur_changements_iban SET statut = 'expiree', expiree_at = now()
   WHERE apporteur_id = ap2 AND statut = 'a_confirmer' AND demandee_at < now() - interval '24 hours';
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (gen_random_uuid(), ap2, chiffre, h, '1234', 'espace');
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
  FOREACH mauvais IN ARRAY ARRAY['FR7630006000011234567890189', 'enc:v2:FR7630006000011234567890189', 'enc:v1:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32), '']
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
-- Cas qui ont besoin de dates passees : seul le declencheur d'horloge est desactive (transaction annulee).
ALTER TABLE apporteur_changements_iban DISABLE TRIGGER apporteur_changements_iban_horloge;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
BEGIN
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'inconnu');
    RAISE EXCEPTION 'AXT99 statut inconnu accepte';
  EXCEPTION WHEN check_violation THEN NULL; WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
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
  -- confirmee sans date de confirmation ; validee sans auteur ; refusee sans motif : refuses (par UPDATE, car
  -- une demande ne s'insere qu'a_confirmer).
  DECLARE d uuid := gen_random_uuid();
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (d, gen_random_uuid(), chiffre, h, '1234', 'espace');
    BEGIN
      UPDATE apporteur_changements_iban SET statut = 'confirmee' WHERE id = d;
      RAISE EXCEPTION 'AXT99 confirmee sans date acceptee';
    EXCEPTION WHEN check_violation THEN NULL; END;
    UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() WHERE id = d;
    BEGIN
      UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now(), traitee_par = gen_random_uuid() WHERE id = d;
      RAISE EXCEPTION 'AXT99 validee avant 72 h acceptee';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now() WHERE id = d;
      RAISE EXCEPTION 'AXT99 validee sans auteur acceptee';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE apporteur_changements_iban SET statut = 'refusee', traitee_at = now(), traitee_par = gen_random_uuid(), motif_refus = '   ' WHERE id = d;
      RAISE EXCEPTION 'AXT99 refusee sans motif acceptee';
    EXCEPTION WHEN check_violation THEN NULL; END;
  END;
  -- une demande naît « a_confirmer » : jamais deja confirmee, validee ou refusee (garde INSERT).
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut, confirmee_at, traitee_at, traitee_par)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'validee', now() - interval '72 hours', now(), gen_random_uuid());
    RAISE EXCEPTION 'AXT99 demande inseree deja validee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, statut, confirmee_at)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', 'confirmee', now() - interval '72 hours');
    RAISE EXCEPTION 'AXT99 demande inseree deja confirmee et antidatee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, controles)
    VALUES (gen_random_uuid(), gen_random_uuid(), chiffre, h, '1234', 'espace', '{}'::jsonb);
    RAISE EXCEPTION 'AXT99 demande inseree avec des controles';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  -- les cas coherents s'obtiennent par les transitions : validee, refusee.
  DECLARE v uuid := gen_random_uuid(); r uuid := gen_random_uuid();
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    VALUES (v, gen_random_uuid(), chiffre, h, '1234', 'espace'), (r, gen_random_uuid(), chiffre, h, '1234', 'console');
    UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() - interval '73 hours' WHERE id IN (v, r);
    UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now(), traitee_par = gen_random_uuid(), controles = '{"cases":3}'::jsonb WHERE id = v;
    UPDATE apporteur_changements_iban SET statut = 'refusee', traitee_at = now(), traitee_par = gen_random_uuid(), motif_refus = 'Titulaire different' WHERE id = r;
    -- la confirmation ne se reecrit pas, la decision gele les controles.
    BEGIN
      UPDATE apporteur_changements_iban SET controles = '{}'::jsonb WHERE id = v;
      RAISE EXCEPTION 'AXT99 controles reecrits apres decision';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
    BEGIN
      UPDATE apporteur_changements_iban SET confirmation_ip_hash = 'x' WHERE id = v;
      RAISE EXCEPTION 'AXT99 preuve de confirmation reecrite apres decision';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  END;
END $$;
ROLLBACK;

-- 4. Jamais de DELETE ni de TRUNCATE ; le coeur d'une demande ne change pas ; une demande decidee est figee ;
--    on ne saute pas a « validee » sans passer par « confirmee ».
BEGIN;
-- Cas qui ont besoin de dates passees : seul le declencheur d'horloge est desactive (transaction annulee).
ALTER TABLE apporteur_changements_iban DISABLE TRIGGER apporteur_changements_iban_horloge;
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
  UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() - interval '73 hours' WHERE id = d;
  -- la date de confirmation ne s'antidate pas (le delai de 72 h repose dessus)
  BEGIN
    UPDATE apporteur_changements_iban SET confirmee_at = now() - interval '5 days' WHERE id = d;
    RAISE EXCEPTION 'AXT99 confirmee_at antidate';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
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
  rid uuid := gen_random_uuid();
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
  -- ni suppression, ni remplacement des octets ; seule la purge passe.
  INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille)
  VALUES (rid, axb1, h, 'application/pdf', 44);
  BEGIN
    DELETE FROM apporteur_changements_iban_rib WHERE demande_id = rid;
    RAISE EXCEPTION 'AXT99 DELETE RIB accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    TRUNCATE apporteur_changements_iban_rib;
    RAISE EXCEPTION 'AXT99 TRUNCATE RIB accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_changements_iban_rib SET octets = '\x41584231ff'::bytea, taille = 5 WHERE demande_id = rid;
    RAISE EXCEPTION 'AXT99 RIB remplace';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF; END;
  UPDATE apporteur_changements_iban_rib SET octets = NULL, purge_at = now() WHERE demande_id = rid;
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
  -- un seul compte en vigueur par apporteur
  BEGIN
    INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
    SELECT gen_random_uuid(), apporteur_id, iban, iban_empreinte, iban_fin4, 'dossier_initial' FROM apporteur_iban_historique WHERE id = id1;
    RAISE EXCEPTION 'AXT99 deux comptes en vigueur';
  EXCEPTION WHEN unique_violation THEN NULL; END;
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

-- 7. Le compte d'un virement : ajout seul ; une autofacture peut etre versee en PLUSIEURS fois (deux instants,
--    deux comptes), mais le meme « Virement fait » rejoue n'ecrit pas deux lignes.
BEGIN;
DO $$
DECLARE
  h text := repeat('d', 64);
  t1 timestamptz := '2026-11-26 10:00:00+00';
BEGIN
  INSERT INTO apporteur_virements_compte (id, autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, verse_at, declare_par)
  VALUES (gen_random_uuid(), 'AXI-APP-TEST-1', gen_random_uuid(), h, '1234', t1, 'admin-test');
  INSERT INTO apporteur_virements_compte (id, autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, verse_at, declare_par)
  VALUES (gen_random_uuid(), 'AXI-APP-TEST-1', gen_random_uuid(), h, '5678', t1 + interval '60 days', 'admin-test');
  BEGIN
    INSERT INTO apporteur_virements_compte (id, autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, verse_at, declare_par)
    VALUES (gen_random_uuid(), 'AXI-APP-TEST-1', gen_random_uuid(), h, '1234', t1, 'admin-test');
    RAISE EXCEPTION 'AXT99 meme virement ecrit deux fois';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO apporteur_virements_compte (id, autofacture_numero, apporteur_id, iban_empreinte, iban_fin4, verse_at, declare_par)
    VALUES (gen_random_uuid(), 'AXI-APP-TEST-2', gen_random_uuid(), 'FR7630006000011234567890189', '1234', t1, 'admin-test');
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

-- 8. Les dates d'etape sont POSEES par la base : toute date fournie par l'appelant est ecrasee (ni confirmation
--    antidatee, ni date de decision dans le futur) ; validation avant 72 h reelles refusee ; champ de suivi
--    (dont la preuve de confirmation) pose hors de sa transition refuse.
BEGIN;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
  d uuid := gen_random_uuid();
  v timestamptz;
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, demandee_at)
  VALUES (d, gen_random_uuid(), chiffre, h, '1234', 'espace', now() - interval '3 days');
  SELECT demandee_at INTO v FROM apporteur_changements_iban WHERE id = d;
  IF abs(extract(epoch FROM clock_timestamp() - v)) > 5 THEN
    RAISE EXCEPTION 'AXT99 demandee_at fournie par l appelant conservee : %', v;
  END IF;
  -- champs de suivi hors transition
  BEGIN
    UPDATE apporteur_changements_iban SET opposee_at = now() WHERE id = d;
    RAISE EXCEPTION 'AXT99 opposee_at pose sans opposition';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avec sa transition%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_changements_iban SET motif_refus = 'x', traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 motif pose sans decision';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avec sa transition%' THEN RAISE; END IF; END;
  -- la preuve de la confirmation ne s'ecrit pas sur une demande non confirmee (constat 3)
  BEGIN
    UPDATE apporteur_changements_iban SET confirmation_ip_hash = 'x' WHERE id = d;
    RAISE EXCEPTION 'AXT99 empreinte d adresse de confirmation posee sans confirmation';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avec sa transition%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE apporteur_changements_iban SET confirmation_navigateur = 'x' WHERE id = d;
    RAISE EXCEPTION 'AXT99 navigateur de confirmation pose sans confirmation';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avec sa transition%' THEN RAISE; END IF; END;
  UPDATE apporteur_changements_iban SET avis_envoye_at = now() WHERE id = d;
  BEGIN
    UPDATE apporteur_changements_iban SET avis_envoye_at = now() + interval '1 hour' WHERE id = d;
    RAISE EXCEPTION 'AXT99 avis_envoye_at reecrit';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avec sa transition%' THEN RAISE; END IF; END;
  -- confirmation SANS preuve (hachage nul) : la preuve ne se pose pas non plus plus tard.
  -- confirmee_at antidatee de 10 jours : la base la remplace par son horloge.
  UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() - interval '10 days' WHERE id = d;
  SELECT confirmee_at INTO v FROM apporteur_changements_iban WHERE id = d;
  IF abs(extract(epoch FROM clock_timestamp() - v)) > 5 THEN
    RAISE EXCEPTION 'AXT99 confirmee_at antidatee conservee : %', v;
  END IF;
  BEGIN
    UPDATE apporteur_changements_iban SET confirmation_ip_hash = 'x' WHERE id = d;
    RAISE EXCEPTION 'AXT99 preuve de confirmation posee apres coup';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avec sa transition%' THEN RAISE; END IF; END;
  -- traitee_at dans le futur : ecrasee, donc la validation reste refusee faute de 72 h reelles.
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now() + interval '3 days', traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 validation datee dans le futur acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avant la fin du d%' THEN RAISE; END IF; END;
  -- le refus n'attend pas 72 h, et sa date est celle de la base meme si l'appelant en fournit une autre.
  UPDATE apporteur_changements_iban SET statut = 'refusee', traitee_at = now() - interval '9 days', traitee_par = gen_random_uuid(), motif_refus = 'Titulaire different' WHERE id = d;
  SELECT traitee_at INTO v FROM apporteur_changements_iban WHERE id = d;
  IF abs(extract(epoch FROM clock_timestamp() - v)) > 5 THEN
    RAISE EXCEPTION 'AXT99 traitee_at fournie par l appelant conservee : %', v;
  END IF;
END $$;
ROLLBACK;

-- 8 bis. Preuve de confirmation ECRITE avec la transition : permise ; puis figee. Validation apres 72 h reelles
--        (confirmation fabriquee ancienne, declencheur remis en place avant la decision) : date posee par la base.
BEGIN;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
  d uuid := gen_random_uuid();
  v timestamptz;
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (d, gen_random_uuid(), chiffre, h, '1234', 'espace');
  ALTER TABLE apporteur_changements_iban DISABLE TRIGGER apporteur_changements_iban_horloge;
  UPDATE apporteur_changements_iban SET statut = 'confirmee', confirmee_at = now() - interval '73 hours',
         confirmation_ip_hash = repeat('f', 64), confirmation_navigateur = 'navigateur fictif' WHERE id = d;
  ALTER TABLE apporteur_changements_iban ENABLE TRIGGER apporteur_changements_iban_horloge;
  BEGIN
    UPDATE apporteur_changements_iban SET confirmation_ip_hash = repeat('0', 64) WHERE id = d;
    RAISE EXCEPTION 'AXT99 preuve de confirmation reecrite';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%preuve de la confirmation%' THEN RAISE; END IF; END;
  UPDATE apporteur_changements_iban SET statut = 'validee', traitee_at = now() - interval '5 days', traitee_par = gen_random_uuid() WHERE id = d;
  SELECT traitee_at INTO v FROM apporteur_changements_iban WHERE id = d;
  IF abs(extract(epoch FROM clock_timestamp() - v)) > 5 THEN
    RAISE EXCEPTION 'AXT99 traitee_at de la validation fournie par l appelant conservee : %', v;
  END IF;
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE
  h text := repeat('d', 64);
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  id1 uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine, en_vigueur_de, en_vigueur_jusqua)
    VALUES (id1, gen_random_uuid(), chiffre, h, '1234', 'dossier_initial', now(), now() - interval '1 day');
    RAISE EXCEPTION 'AXT99 fin de validite avant le debut acceptee';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;

-- 9. Une demande CONFIRMEE compte comme ouverte : pas de seconde demande a cote.
BEGIN;
DO $$
DECLARE
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64); ap uuid := gen_random_uuid(); d uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (d, ap, chiffre, h, '1234', 'espace');
  UPDATE apporteur_changements_iban SET statut = 'confirmee' WHERE id = d;
  BEGIN
    INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (gen_random_uuid(), ap, chiffre, h, '1234', 'espace');
    RAISE EXCEPTION 'AXT99 seconde demande ouverte acceptee a cote d une confirmee';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;

-- 10. Les octets seuls d'un RIB ne se remplacent pas (garde visee par son MESSAGE, pas par n'importe quelle exception).
BEGIN;
DO $$
DECLARE axb1 bytea := '\x41584231' || decode(repeat('00', 40), 'hex'); rid uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban_rib (demande_id, octets, sha256, type_mime, taille) VALUES (rid, axb1, repeat('e',64), 'application/pdf', 44);
  BEGIN
    UPDATE apporteur_changements_iban_rib SET octets = '\x41584231ff'::bytea WHERE demande_id = rid;
    RAISE EXCEPTION 'AXT99 octets du RIB remplaces';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%jamais remplac%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

-- 11. Le verrou des 72 h, par son message : une validation posee tout de suite est refusee par le declencheur
--     (et non par le seul CHECK de coherence, qui leverait une check_violation non attrapee ici).
BEGIN;
DO $$
DECLARE chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32); d uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (d, gen_random_uuid(), chiffre, repeat('d',64), '1234', 'espace');
  UPDATE apporteur_changements_iban SET statut = 'confirmee' WHERE id = d;
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'validee', traitee_par = gen_random_uuid() WHERE id = d;
    RAISE EXCEPTION 'AXT99 validation avant 72 h reelles acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%avant la fin du d%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;

-- 12. Une demande confirmee ne revient pas a « a_confirmer » (par son message).
BEGIN;
DO $$
DECLARE chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32); d uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine) VALUES (d, gen_random_uuid(), chiffre, repeat('d',64), '1234', 'espace');
  UPDATE apporteur_changements_iban SET statut = 'confirmee' WHERE id = d;
  BEGIN
    UPDATE apporteur_changements_iban SET statut = 'a_confirmer' WHERE id = d;
    RAISE EXCEPTION 'AXT99 retour a a_confirmer accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%transition%interdite%' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
