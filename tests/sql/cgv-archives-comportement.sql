-- COMPORTEMENT de l archive immuable `cgv_archives` (migration 20261104160000_cgv_archives).
-- Lance par ci.yml : psql -v ON_ERROR_STOP=1 -f tests/sql/cgv-archives-comportement.sql
-- Chaque cas vit dans SA transaction ANNULEE. Une attente decue remonte (AXT99), psql s arrete, Gate D rougit.
\set QUIET on

BEGIN;
-- 1. UPDATE, DELETE, TRUNCATE refuses ; INSERT accepte ; doublon de version refuse.
DO $$
DECLARE
  h text := repeat('a', 64);
BEGIN
  INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
  VALUES ('t-1', 'test', '{}', h, 'legal/cgv/t-1/' || h || '.pdf', h, 10);

  BEGIN
    UPDATE cgv_archives SET libelle = 'x' WHERE version = 't-1';
    RAISE EXCEPTION 'AXT99 UPDATE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  BEGIN
    DELETE FROM cgv_archives WHERE version = 't-1';
    RAISE EXCEPTION 'AXT99 DELETE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  BEGIN
    TRUNCATE cgv_archives;
    RAISE EXCEPTION 'AXT99 TRUNCATE accepte';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'AXT99%' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('t-1', 'bis', '{}', h, 'k', h, 10);
    RAISE EXCEPTION 'AXT99 doublon accepte';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- INSERT ... ON CONFLICT DO NOTHING (idempotence du service) ne declenche aucun refus.
  INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
  VALUES ('t-1', 'bis', '{}', h, 'k', h, 10) ON CONFLICT (version) DO NOTHING;
END $$;
ROLLBACK;

BEGIN;
-- 2. Les CHECK refusent une empreinte mal formee et une taille nulle.
DO $$
BEGIN
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('t-2', 't', '{}', 'ABC', 'k', repeat('a', 64), 10);
    RAISE EXCEPTION 'AXT99 empreinte invalide acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO cgv_archives (version, libelle, texte_canonique, texte_sha256, pdf_r2_key, pdf_sha256, pdf_taille)
    VALUES ('t-3', 't', '{}', repeat('a', 64), 'k', repeat('a', 64), 0);
    RAISE EXCEPTION 'AXT99 taille nulle acceptee';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
