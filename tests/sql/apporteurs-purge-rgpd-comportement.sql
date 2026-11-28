-- COMPORTEMENT de la purge RGPD des apporteurs (migration 20261128120000_apporteurs_purge_rgpd, PR N, #2464 pt 6).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/apporteurs-purge-rgpd-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
-- Les valeurs chiffrees sont FICTIVES (forme `enc:v2:`). Aucune donnee reelle.
\set QUIET on

-- 1. Historique des comptes : la purge exige le reglage local, ne change que iban et iban_purge_at, ne revient pas.
BEGIN;
DO $$
DECLARE
  ap uuid := gen_random_uuid();
  id1 uuid := gen_random_uuid();
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  autre text := 'enc:v2:' || repeat('1', 24) || ':' || repeat('2', 40) || ':' || repeat('3', 32);
  h text := repeat('d', 64);
BEGIN
  INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (id1, ap, chiffre, h, '1234', 'dossier_initial');
  -- sans reglage : refusee
  BEGIN
    UPDATE apporteur_iban_historique SET iban = 'purge', iban_purge_at = now() WHERE id = id1;
    RAISE EXCEPTION 'AXT99 purge sans reglage acceptee (historique)';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  -- date de purge seule : refusee meme avec le reglage
  PERFORM set_config('axion.reecriture_pii', 'purge', true);
  BEGIN
    UPDATE apporteur_iban_historique SET iban_purge_at = now() WHERE id = id1;
    RAISE EXCEPTION 'AXT99 date de purge seule acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  -- purge + une autre colonne : refusee
  BEGIN
    UPDATE apporteur_iban_historique SET iban = 'purge', iban_purge_at = now(), iban_fin4 = '9999' WHERE id = id1;
    RAISE EXCEPTION 'AXT99 purge avec autre colonne acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  -- 'purge' sans date : refuse par le CHECK
  BEGIN
    UPDATE apporteur_iban_historique SET iban = 'purge' WHERE id = id1;
    RAISE EXCEPTION 'AXT99 purge sans date acceptee';
  EXCEPTION WHEN check_violation OR raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  -- la purge propre passe, empreinte et fin4 restent
  UPDATE apporteur_iban_historique SET iban = 'purge', iban_purge_at = now() WHERE id = id1;
  IF (SELECT iban_empreinte || iban_fin4 FROM apporteur_iban_historique WHERE id = id1) <> h || '1234' THEN
    RAISE EXCEPTION 'AXT99 empreinte ou fin4 perdues';
  END IF;
  -- jamais de retour de 'purge' vers un chiffre (ni en purge, ni en rotation)
  BEGIN
    UPDATE apporteur_iban_historique SET iban = chiffre WHERE id = id1;
    RAISE EXCEPTION 'AXT99 retour de purge vers un chiffre accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  PERFORM set_config('axion.reecriture_pii', 'rotation', true);
  BEGIN
    UPDATE apporteur_iban_historique SET iban = autre WHERE id = id1;
    RAISE EXCEPTION 'AXT99 rotation sur une ligne purgee acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  -- toujours ni suppression ni deuxieme purge
  BEGIN
    DELETE FROM apporteur_iban_historique WHERE id = id1;
    RAISE EXCEPTION 'AXT99 suppression acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;

-- 2. Rotation : un chiffre par un autre chiffre seulement, rien d'autre ne change ; sans reglage, refusee.
BEGIN;
DO $$
DECLARE
  ap uuid := gen_random_uuid();
  id1 uuid := gen_random_uuid();
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  autre text := 'enc:v2:' || repeat('1', 24) || ':' || repeat('2', 40) || ':' || repeat('3', 32);
  h text := repeat('d', 64);
BEGIN
  INSERT INTO apporteur_iban_historique (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (id1, ap, chiffre, h, '1234', 'dossier_initial');
  BEGIN
    UPDATE apporteur_iban_historique SET iban = autre WHERE id = id1;
    RAISE EXCEPTION 'AXT99 rotation sans reglage acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  PERFORM set_config('axion.reecriture_pii', 'rotation', true);
  BEGIN
    UPDATE apporteur_iban_historique SET iban = autre, iban_fin4 = '0000' WHERE id = id1;
    RAISE EXCEPTION 'AXT99 rotation avec autre colonne acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE apporteur_iban_historique SET iban = 'purge', iban_purge_at = now() WHERE id = id1;
    RAISE EXCEPTION 'AXT99 purge sous reglage rotation acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  UPDATE apporteur_iban_historique SET iban = autre WHERE id = id1;
END $$;
ROLLBACK;

-- 3. Demandes de changement : meme contrat, y compris sur une demande deja decidee (figee).
BEGIN;
ALTER TABLE apporteur_changements_iban DISABLE TRIGGER apporteur_changements_iban_horloge;
DO $$
DECLARE
  ap uuid := gen_random_uuid();
  id1 uuid := gen_random_uuid();
  chiffre text := 'enc:v2:' || repeat('a', 24) || ':' || repeat('b', 40) || ':' || repeat('c', 32);
  h text := repeat('d', 64);
BEGIN
  INSERT INTO apporteur_changements_iban (id, apporteur_id, iban, iban_empreinte, iban_fin4, origine)
  VALUES (id1, ap, chiffre, h, '1234', 'espace');
  UPDATE apporteur_changements_iban SET statut = 'annulee', annulee_at = now() WHERE id = id1;
  BEGIN
    UPDATE apporteur_changements_iban SET iban = 'purge', iban_purge_at = now() WHERE id = id1;
    RAISE EXCEPTION 'AXT99 purge sans reglage acceptee (demandes)';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  PERFORM set_config('axion.reecriture_pii', 'purge', true);
  BEGIN
    UPDATE apporteur_changements_iban SET iban = 'purge', iban_purge_at = now(), motif_refus = 'x' WHERE id = id1;
    RAISE EXCEPTION 'AXT99 purge avec autre colonne acceptee (demandes)';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  UPDATE apporteur_changements_iban SET iban = 'purge', iban_purge_at = now() WHERE id = id1;
  IF (SELECT iban_empreinte || iban_fin4 FROM apporteur_changements_iban WHERE id = id1) <> h || '1234' THEN
    RAISE EXCEPTION 'AXT99 empreinte ou fin4 perdues (demandes)';
  END IF;
  BEGIN
    UPDATE apporteur_changements_iban SET iban = chiffre WHERE id = id1;
    RAISE EXCEPTION 'AXT99 retour de purge vers un chiffre accepte (demandes)';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;

-- 4. Le journal de purge est en ajout seul ; regle et elements sont contraints.
BEGIN;
DO $$
DECLARE
  j uuid := gen_random_uuid();
BEGIN
  INSERT INTO apporteur_purges_rgpd (id, apporteur_id, regle, elements, echeance_at)
  VALUES (j, gen_random_uuid(), 'refuse_6mois', ARRAY['pieces_identite', 'rib'], now());
  BEGIN
    INSERT INTO apporteur_purges_rgpd (apporteur_id, regle, elements, echeance_at)
    VALUES (gen_random_uuid(), 'n_importe_quoi', ARRAY['rib'], now());
    RAISE EXCEPTION 'AXT99 regle inconnue acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO apporteur_purges_rgpd (apporteur_id, regle, elements, echeance_at)
    VALUES (gen_random_uuid(), 'refuse_6mois', ARRAY['nom'], now());
    RAISE EXCEPTION 'AXT99 element inconnu accepte';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE apporteur_purges_rgpd SET regle = 'piece_6mois' WHERE id = j;
    RAISE EXCEPTION 'AXT99 modification acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM apporteur_purges_rgpd WHERE id = j;
    RAISE EXCEPTION 'AXT99 suppression acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;
