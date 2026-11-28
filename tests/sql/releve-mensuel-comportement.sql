-- COMPORTEMENT des relevés mensuels des apporteurs (migration 20261127200000_apporteurs_releve_mensuel).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/releve-mensuel-comportement.sql
-- Rejoue, colonne par colonne, les ecritures de `envoi.ts`, `preparation.ts` et `rectificatif.ts` face au
-- declencheur `releves_mensuels_apporteur_garde_update` et aux CHECK. Les ecritures que le code FAIT doivent
-- passer ; les controles NEGATIFS (ecritures que la base DOIT refuser) levent AXT99 si elles passent.
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
-- Donnees FICTIVES.
\set QUIET on

CREATE SEQUENCE pg_temp.seq_releve_test;

-- Fabrique d'un releve dans l'etat voulu (INSERT : le declencheur ne regarde que les UPDATE).
-- Vit dans le schema temporaire de la session ; chaque appel est fait DANS une transaction annulee.
CREATE FUNCTION pg_temp.releve(
  p_statut statut_releve_mensuel,
  p_pris boolean,
  p_rang integer DEFAULT 0,
  p_rect uuid DEFAULT NULL,
  p_ap uuid DEFAULT NULL,
  p_periode text DEFAULT '2026-10'
) RETURNS uuid AS $$
DECLARE
  ap uuid := p_ap;
  rid uuid := gen_random_uuid();
  num text;
BEGIN
  IF ap IS NULL THEN
    ap := gen_random_uuid();
    INSERT INTO apporteurs_reseau (id, prenom, nom, email, email_hash, maj_at)
    VALUES (ap, 'enc:v2:fictif', 'enc:v2:fictif', 'enc:v2:fictif', md5(ap::text) || md5(ap::text), now());
  END IF;
  num := 'REL-' || p_periode || '-' || lpad(nextval('pg_temp.seq_releve_test')::text, 4, '0')
         || CASE WHEN p_rang > 0 THEN '-R' || p_rang ELSE '' END;
  INSERT INTO releves_mensuels_apporteur (
    id, numero, apporteur_id, periode, rang, rectifie_id, statut, coupure_at, contenu, empreinte_sha256,
    pdf_r2_key, pdf_sha256, pris_at, envoye_at, envoye_par, email_job_id, motif_ecart, erreur, maj_at
  ) VALUES (
    rid, num, ap, p_periode, p_rang, p_rect, p_statut, now(), '{"v":1}'::jsonb, repeat('b', 64),
    'apporteurs/releves/x.pdf', repeat('c', 64),
    CASE WHEN p_pris THEN now() - interval '1 hour' END,
    CASE WHEN p_statut = 'envoye' THEN now() - interval '30 minutes' END,
    CASE WHEN p_statut = 'envoye' THEN 'console:fictif' END,
    CASE WHEN p_statut = 'envoye' THEN 'job-' || rid END,
    CASE WHEN p_statut = 'ecarte' THEN 'motif fictif' END,
    CASE WHEN p_statut = 'echec' THEN 'envoi non parti (fictif)' END,
    now()
  );
  RETURN rid;
END $$ LANGUAGE plpgsql;

-- 1. « Renvoyer les echecs » : echec -> envoi_en_cours SANS reecrire pris_at -> envoye (envoi.ts, prise conditionnelle).
BEGIN;
DO $$
DECLARE
  r uuid := pg_temp.releve('echec', true);
  lot uuid := gen_random_uuid();
BEGIN
  INSERT INTO lots_releve_mensuel (id, periode, declenche_par) VALUES (lot, '2026-10', 'console:fictif');
  UPDATE releves_mensuels_apporteur SET statut = 'envoi_en_cours', lot_id = lot, erreur = NULL, maj_at = now()
   WHERE id = r AND statut = 'echec';
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = r) <> 'envoi_en_cours' THEN
    RAISE EXCEPTION 'AXT99 la prise d une ligne echec n a pas eu lieu';
  END IF;
  UPDATE releves_mensuels_apporteur
     SET statut = 'envoye', envoye_at = now(), envoye_par = 'console:fictif', email_job_id = 'job-' || r, maj_at = now()
   WHERE id = r AND statut = 'envoi_en_cours';
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = r) <> 'envoye' THEN
    RAISE EXCEPTION 'AXT99 la ligne echec renvoyee n est pas passee a envoye';
  END IF;
END $$;
ROLLBACK;

-- 1b. NEGATIF : reecrire pris_at depuis `echec` (l'ancien code) est REFUSE par le declencheur.
BEGIN;
DO $$
DECLARE r uuid := pg_temp.releve('echec', true);
BEGIN
  BEGIN
    UPDATE releves_mensuels_apporteur SET statut = 'envoi_en_cours', pris_at = now() + interval '1 second', maj_at = now()
     WHERE id = r AND statut = 'echec';
    RAISE EXCEPTION 'AXT99 pris_at reecrit depuis echec sans refus';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%figé%' THEN RAISE EXCEPTION 'AXT99 refus pour une autre raison : %', SQLERRM; END IF;
  END;
END $$;
ROLLBACK;

-- 2. Ligne `prepare` : prise avec pris_at -> envoye (chemin normal de envoi.ts).
BEGIN;
DO $$
DECLARE r uuid := pg_temp.releve('prepare', false);
BEGIN
  UPDATE releves_mensuels_apporteur SET statut = 'envoi_en_cours', pris_at = now(), erreur = NULL, maj_at = now()
   WHERE id = r AND statut = 'prepare';
  UPDATE releves_mensuels_apporteur
     SET statut = 'envoye', envoye_at = now(), envoye_par = 'console:fictif', email_job_id = 'job-' || r, maj_at = now()
   WHERE id = r AND statut = 'envoi_en_cours';
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = r) <> 'envoye' THEN
    RAISE EXCEPTION 'AXT99 la ligne prepare n est pas passee a envoye';
  END IF;
END $$;
ROLLBACK;

-- 3. « Deja envoye » constate sur une ligne `prepare` : pris_at pose dans la MEME ecriture (CHECK prise_tracee).
BEGIN;
DO $$
DECLARE r uuid := pg_temp.releve('prepare', false);
BEGIN
  UPDATE releves_mensuels_apporteur
     SET statut = 'envoye', pris_at = now(), envoye_at = now(), envoye_par = 'console:fictif',
         email_job_id = 'job-' || r, lot_id = NULL, erreur = NULL, maj_at = now()
   WHERE id = r AND statut IN ('prepare', 'echec');
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = r) <> 'envoye' THEN
    RAISE EXCEPTION 'AXT99 deja envoye sur prepare refuse';
  END IF;
END $$;
ROLLBACK;

-- 3b. « Deja envoye » sur une ligne `echec` : pris_at conserve (non reecrit).
BEGIN;
DO $$
DECLARE r uuid := pg_temp.releve('echec', true);
BEGIN
  UPDATE releves_mensuels_apporteur
     SET statut = 'envoye', envoye_at = now(), envoye_par = 'console:fictif', email_job_id = 'job-' || r,
         erreur = NULL, maj_at = now()
   WHERE id = r AND statut IN ('prepare', 'echec');
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = r) <> 'envoye' THEN
    RAISE EXCEPTION 'AXT99 deja envoye sur echec refuse';
  END IF;
END $$;
ROLLBACK;

-- 3c. NEGATIF : `envoye` sans pris_at (l'ancien code, ligne `prepare`) est REFUSE par le CHECK prise_tracee.
BEGIN;
DO $$
DECLARE r uuid := pg_temp.releve('prepare', false);
BEGIN
  BEGIN
    UPDATE releves_mensuels_apporteur
       SET statut = 'envoye', envoye_at = now(), envoye_par = 'console:fictif', email_job_id = 'job-' || r, maj_at = now()
     WHERE id = r;
    RAISE EXCEPTION 'AXT99 envoye sans pris_at accepte';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%prise_tracee%' THEN RAISE EXCEPTION 'AXT99 CHECK inattendu : %', SQLERRM; END IF;
  END;
END $$;
ROLLBACK;

-- 4. Une ligne `echec` : l'erreur se met a jour (bloquer) ; la reprise tranche `envoi_en_cours` -> envoye ou echec.
BEGIN;
DO $$
DECLARE
  r uuid := pg_temp.releve('echec', true);
  e1 uuid := pg_temp.releve('envoi_en_cours', true);
  e2 uuid := pg_temp.releve('envoi_en_cours', true);
BEGIN
  UPDATE releves_mensuels_apporteur SET erreur = 'bloque : donnees modifiees', maj_at = now() WHERE id = r AND statut IN ('prepare', 'echec');
  UPDATE releves_mensuels_apporteur SET statut = 'envoye', envoye_at = now(), envoye_par = 'reprise', email_job_id = 'job-' || e1, maj_at = now() WHERE id = e1;
  UPDATE releves_mensuels_apporteur SET statut = 'echec', erreur = 'envoi interrompu', maj_at = now() WHERE id = e2;
  IF (SELECT count(*) FROM releves_mensuels_apporteur WHERE id IN (e1, e2) AND statut IN ('envoye', 'echec')) <> 2 THEN
    RAISE EXCEPTION 'AXT99 reprise d un envoi en cours refusee';
  END IF;
END $$;
ROLLBACK;

-- 5. Ecarter / retablir : permis pour une ligne JAMAIS prise ; refuse des qu'elle l'a ete.
BEGIN;
DO $$
DECLARE
  r uuid := pg_temp.releve('prepare', false);
  p uuid := pg_temp.releve('ecarte', true);
  c uuid := pg_temp.releve('envoi_en_cours', true);
  f uuid := pg_temp.releve('echec', true);
BEGIN
  UPDATE releves_mensuels_apporteur SET statut = 'ecarte', motif_ecart = 'Mois sans activite', maj_at = now() WHERE id = r AND statut = 'prepare' AND pris_at IS NULL;
  UPDATE releves_mensuels_apporteur SET statut = 'prepare', motif_ecart = NULL, maj_at = now() WHERE id = r AND statut = 'ecarte' AND pris_at IS NULL;
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = r) <> 'prepare' THEN
    RAISE EXCEPTION 'AXT99 ecarter puis retablir une ligne jamais prise refuse';
  END IF;
  -- NEGATIFS
  BEGIN
    UPDATE releves_mensuels_apporteur SET statut = 'prepare', motif_ecart = NULL, maj_at = now() WHERE id = p;
    RAISE EXCEPTION 'AXT99 retablissement d une ligne ecartee deja prise accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE releves_mensuels_apporteur SET statut = 'ecarte', motif_ecart = 'x', maj_at = now() WHERE id = c;
    RAISE EXCEPTION 'AXT99 ecart d une ligne en cours d envoi accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE releves_mensuels_apporteur SET statut = 'envoi_en_cours', pris_at = pris_at, maj_at = now() WHERE id = p;
    RAISE EXCEPTION 'AXT99 prise d une ligne ecartee acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE releves_mensuels_apporteur SET statut = 'prepare', maj_at = now() WHERE id = f;
    RAISE EXCEPTION 'AXT99 retour a prepare d une ligne echec accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
END $$;
ROLLBACK;

-- 6. Un releve ENVOYE est fige : statut, totaux, trace d'envoi, contenu, PDF ; ni suppression ni TRUNCATE.
BEGIN;
DO $$
DECLARE
  r uuid := pg_temp.releve('envoye', true);
  champ text;
BEGIN
  FOREACH champ IN ARRAY ARRAY[
    'statut = ''prepare''', 'statut = ''echec''', 'factures_ht_cents = 1', 'avoirs_ht_cents = 1', 'vires_ttc_cents = 1',
    'en_attente_ht_cents = 1', 'cumul_annee_ht_cents = 1', 'nb_lignes = 7', 'envoye_at = now() + interval ''1 day''',
    'envoye_par = ''autre''', 'contenu = ''{"v":2}''::jsonb', 'pdf_r2_key = ''autre.pdf''', 'pris_at = now() + interval ''1 day''',
    'email_job_id = ''autre'''
  ] LOOP
    BEGIN
      EXECUTE format('UPDATE releves_mensuels_apporteur SET %s, maj_at = now() WHERE id = %L', champ, r);
      RAISE EXCEPTION 'AXT99 modification d un releve envoye acceptee : %', champ;
    EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    DELETE FROM releves_mensuels_apporteur WHERE id = r;
    RAISE EXCEPTION 'AXT99 suppression d un releve envoye acceptee';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  BEGIN
    TRUNCATE releves_mensuels_apporteur;
    RAISE EXCEPTION 'AXT99 TRUNCATE accepte';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;
  -- une ligne jamais prise se supprime encore
  DELETE FROM releves_mensuels_apporteur WHERE id = pg_temp.releve('prepare', false);
END $$;
ROLLBACK;

-- 7. Rectificatif -Rk : ligne NEUVE `prepare` a cote d'un original `echec` ou `envoye` ; l'original reste intact.
BEGIN;
DO $$
DECLARE
  ap uuid := gen_random_uuid();
  o uuid;
  rect uuid;
BEGIN
  INSERT INTO apporteurs_reseau (id, prenom, nom, email, email_hash, maj_at)
  VALUES (ap, 'enc:v2:fictif', 'enc:v2:fictif', 'enc:v2:fictif', md5(ap::text) || md5(ap::text), now());
  o := pg_temp.releve('echec', true, 0, NULL, ap);
  rect := pg_temp.releve('prepare', false, 1, o, ap);
  -- envoi du rectificatif : meme chemin qu'une ligne `prepare`
  UPDATE releves_mensuels_apporteur SET statut = 'envoi_en_cours', pris_at = now(), maj_at = now() WHERE id = rect AND statut = 'prepare';
  UPDATE releves_mensuels_apporteur
     SET statut = 'envoye', envoye_at = now(), envoye_par = 'console:fictif', email_job_id = 'job-' || rect, maj_at = now()
   WHERE id = rect AND statut = 'envoi_en_cours';
  IF (SELECT statut FROM releves_mensuels_apporteur WHERE id = rect) <> 'envoye'
     OR (SELECT statut FROM releves_mensuels_apporteur WHERE id = o) <> 'echec' THEN
    RAISE EXCEPTION 'AXT99 envoi du rectificatif : etats inattendus';
  END IF;
  -- NEGATIF : un rang > 0 sans original, un rang 0 avec original.
  BEGIN
    PERFORM pg_temp.releve('prepare', false, 2, NULL, ap);
    RAISE EXCEPTION 'AXT99 rang > 0 sans rectifie_id accepte';
  EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%rang_coherent%' THEN RAISE EXCEPTION 'AXT99 CHECK inattendu : %', SQLERRM; END IF;
  END;
END $$;
ROLLBACK;

-- 8. Un seul lot VIVANT par periode ; un lot ferme laisse la place.
BEGIN;
DO $$
DECLARE l1 uuid := gen_random_uuid();
BEGIN
  INSERT INTO lots_releve_mensuel (id, periode, declenche_par) VALUES (l1, '2026-10', 'console:fictif');
  BEGIN
    INSERT INTO lots_releve_mensuel (id, periode, declenche_par) VALUES (gen_random_uuid(), '2026-10', 'console:fictif');
    RAISE EXCEPTION 'AXT99 deuxieme lot vivant accepte';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO lots_releve_mensuel (id, periode, declenche_par) VALUES (gen_random_uuid(), '2026-09', 'console:fictif');
  UPDATE lots_releve_mensuel SET fin_at = now() WHERE id = l1;
  INSERT INTO lots_releve_mensuel (id, periode, declenche_par) VALUES (gen_random_uuid(), '2026-10', 'console:fictif');
END $$;
ROLLBACK;
